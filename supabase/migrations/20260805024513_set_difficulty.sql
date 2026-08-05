-- Per-set difficulty feedback + adaptive volume (Session 13 Part 3).
--
-- Every logged set can carry a one-tap easy/normal/hard signal. The signal is
-- pure feedback: it awards nothing, and the adaptation engine it feeds only ever
-- PROPOSES a prescription change — accepting is always the user's tap.
--
-- Nullable on purpose: historical sets have no signal, and the engine reads
-- null as 'normal' (lib/fitness/adaptation.ts).

-- ---------------------------------------------------------------------------
-- 1. The signal itself.
-- ---------------------------------------------------------------------------
alter table public.workout_sets
  add column difficulty text
    check (difficulty is null or difficulty in ('easy', 'normal', 'hard'));

comment on column public.workout_sets.difficulty is 'How the set felt (easy/normal/hard). Null = no feedback given; the adaptation engine treats it as normal.';

-- ---------------------------------------------------------------------------
-- 2. Adjustment history — every proposal the user accepted or dismissed.
--    Plain user data (no XP), so owner CRUD via RLS rather than a definer path.
-- ---------------------------------------------------------------------------
create table public.prescription_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_item_id uuid references public.routine_items (id) on delete set null,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind text not null
    check (kind in ('increment', 'hold', 'deload', 'next_progression')),
  outcome text not null check (outcome in ('accepted', 'dismissed')),
  from_sets integer,
  from_reps integer,
  to_sets integer,
  to_reps integer,
  created_at timestamptz not null default now()
);

create index prescription_adjustments_user_item_idx
  on public.prescription_adjustments (user_id, routine_item_id, created_at desc);

comment on table public.prescription_adjustments is 'Log of proposed volume changes and what the user did with them. A dismissal suppresses that proposal until newer training evidence exists.';

alter table public.prescription_adjustments enable row level security;

create policy "Prescription adjustments: owner select"
  on public.prescription_adjustments for select using (user_id = auth.uid());
create policy "Prescription adjustments: owner insert"
  on public.prescription_adjustments for insert with check (user_id = auth.uid());
create policy "Prescription adjustments: owner update"
  on public.prescription_adjustments for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "Prescription adjustments: owner delete"
  on public.prescription_adjustments for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. complete_workout: identical behaviour, now persisting each set's
--    difficulty. Recreated in full because the body is the sole writer of
--    workout_sets (rule 6) — same shape as the Session 13 Part 2 version.
-- ---------------------------------------------------------------------------
create or replace function public.complete_workout(
  p_routine_id uuid default null,
  p_sets jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user              uuid := auth.uid();
  v_today             date;
  v_weekday           text;
  v_workout_id        uuid;
  v_is_scheduled      boolean := false;
  v_already_completed boolean := false;
  v_bonus_used        boolean;
  v_action            text;
  v_base_xp           integer := 0;
  v_points            integer := 0;
  v_xp                integer := 0;
  v_len               integer;
  v_mult              numeric;
  v_milestones        integer;
  v_reset             boolean;
  v_unlocks           jsonb := '[]'::jsonb;
  v_prs               jsonb := '[]'::jsonb;
  v_challenges        jsonb := '[]'::jsonb;
  v_ex                record;
  v_met               boolean;
  v_award_xp          integer;
  v_pr                record;
  v_hist_reps         integer;
  v_hist_seconds      integer;
  v_unlock            jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_today := (now() at time zone 'America/Mexico_City')::date;
  v_weekday := to_char(v_today, 'dy');

  perform 1 from public.streaks where user_id = v_user for update;

  if p_routine_id is not null then
    if not exists (
      select 1 from public.routines where id = p_routine_id and user_id = v_user
    ) then
      raise exception 'routine not found';
    end if;

    select exists (
      select 1 from public.routines
      where id = p_routine_id and user_id = v_user and v_weekday = any (day_of_week)
    ) into v_is_scheduled;

    select exists (
      select 1 from public.workouts
      where user_id = v_user and routine_id = p_routine_id
        and date = v_today and status = 'completed'
    ) into v_already_completed;
  end if;

  insert into public.workouts (user_id, date, routine_id, status)
  values (v_user, v_today, p_routine_id, 'completed')
  returning id into v_workout_id;

  insert into public.workout_sets (workout_id, exercise_id, set_no, reps, seconds, rpe, difficulty)
  select
    v_workout_id,
    (s->>'exercise_id')::uuid,
    (s->>'set_no')::integer,
    nullif(s->>'reps', '')::integer,
    nullif(s->>'seconds', '')::integer,
    nullif(s->>'rpe', '')::numeric,
    nullif(s->>'difficulty', '')
  from jsonb_array_elements(p_sets) as s;

  select * into v_len, v_mult, v_milestones, v_reset
  from public.evaluate_streak_and_award(v_user, v_today, true, v_workout_id);

  if v_is_scheduled and not v_already_completed then
    v_action := 'scheduled_workout';
    v_base_xp := 100;
    v_points := 10;
  else
    select exists (
      select 1 from public.xp_ledger
      where user_id = v_user and action = 'bonus_workout'
        and (ts at time zone 'America/Mexico_City')::date = v_today
    ) into v_bonus_used;

    if not v_bonus_used then
      v_action := 'bonus_workout';
      v_base_xp := 50;
      v_points := 5;
    else
      v_action := 'capped';
    end if;
  end if;

  if v_base_xp > 0 then
    v_xp := round(v_base_xp * v_mult)::integer;
    insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
    values (v_user, v_action, v_xp, v_points, v_workout_id, v_today);
    update public.workouts set xp_awarded = v_xp where id = v_workout_id;
  end if;

  -- Personal records — unchanged.
  for v_pr in
    select ws.exercise_id, e.slug, e.name,
           max(ws.reps) as best_reps, max(ws.seconds) as best_seconds
    from public.workout_sets ws
    join public.exercises e on e.id = ws.exercise_id
    where ws.workout_id = v_workout_id
    group by ws.exercise_id, e.slug, e.name
  loop
    select max(ws.reps), max(ws.seconds)
    into v_hist_reps, v_hist_seconds
    from public.workout_sets ws
    join public.workouts w on w.id = ws.workout_id
    where w.user_id = v_user
      and ws.exercise_id = v_pr.exercise_id
      and ws.workout_id <> v_workout_id;

    if v_pr.best_reps is not null and v_hist_reps is not null
       and v_pr.best_reps > v_hist_reps then
      v_award_xp := round(75 * v_mult)::integer;
      insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
      values (v_user, 'personal_record', v_award_xp, 10, v_pr.exercise_id, v_today);
      v_prs := v_prs || jsonb_build_object(
        'exercise_id', v_pr.exercise_id, 'slug', v_pr.slug, 'name', v_pr.name,
        'metric', 'reps', 'value', v_pr.best_reps, 'xp', v_award_xp);
    elsif v_pr.best_seconds is not null and v_hist_seconds is not null
       and v_pr.best_seconds > v_hist_seconds then
      v_award_xp := round(75 * v_mult)::integer;
      insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
      values (v_user, 'personal_record', v_award_xp, 10, v_pr.exercise_id, v_today);
      v_prs := v_prs || jsonb_build_object(
        'exercise_id', v_pr.exercise_id, 'slug', v_pr.slug, 'name', v_pr.name,
        'metric', 'seconds', 'value', v_pr.best_seconds, 'xp', v_award_xp);
    end if;
  end loop;

  -- Skill unlocks for exercises actually performed — path adjacency, unchanged.
  for v_ex in
    select e.id, e.unlock_criteria
    from public.exercises e
    join public.skill_path_nodes n on n.exercise_id = e.id
    where e.unlock_criteria is not null
      and e.id in (select exercise_id from public.workout_sets where workout_id = v_workout_id)
    group by e.id, e.unlock_criteria
    order by min(n.position), e.id
  loop
    if exists (
      select 1 from public.skill_unlocks
      where user_id = v_user and exercise_id = v_ex.id
    ) then
      continue;
    end if;

    if not exists (
      select 1 from public.skill_path_nodes n
      where n.exercise_id = v_ex.id
        and (
          n.position = 1
          or exists (
            select 1 from public.skill_path_nodes prev
            join public.skill_unlocks su
              on su.exercise_id = prev.exercise_id and su.user_id = v_user
            where prev.path_id = n.path_id and prev.position = n.position - 1
          )
        )
    ) then
      continue;
    end if;

    if v_ex.unlock_criteria->>'kind' = 'reps' then
      select count(*) >= (v_ex.unlock_criteria->>'sets')::integer into v_met
      from public.workout_sets
      where workout_id = v_workout_id and exercise_id = v_ex.id
        and reps >= (v_ex.unlock_criteria->>'reps')::integer;
    elsif v_ex.unlock_criteria->>'kind' = 'hold' then
      select count(*) >= (v_ex.unlock_criteria->>'sets')::integer into v_met
      from public.workout_sets
      where workout_id = v_workout_id and exercise_id = v_ex.id
        and seconds >= (v_ex.unlock_criteria->>'seconds')::integer;
    else
      v_met := false;
    end if;

    if v_met then
      v_unlock := public.award_skill_unlock(
        v_user, v_ex.id, v_workout_id,
        round(200 * v_mult)::integer, 25, 'skill_unlock', v_today);
      if v_unlock is not null then
        v_unlocks := v_unlocks || v_unlock;
        -- An incidental unlock closes any open challenge for that node.
        update public.skill_challenges
        set status = 'completed', resolved_at = now()
        where user_id = v_user and exercise_id = v_ex.id;
      end if;
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- Readiness OFFERS: for each exercise trained (and now unlocked), look at the
  -- next node in every path containing it. If that node is still locked and this
  -- workout's numbers already reach ITS criteria, offer a challenge. Deduped per
  -- target node, and never offered twice for the same workout.
  -- -------------------------------------------------------------------------
  with logged as (
    select exercise_id, reps, seconds
    from public.workout_sets where workout_id = v_workout_id
  ),
  trained_unlocked as (
    select distinct ws.exercise_id
    from public.workout_sets ws
    join public.skill_unlocks su
      on su.exercise_id = ws.exercise_id and su.user_id = v_user
    where ws.workout_id = v_workout_id
  ),
  neighbours as (
    select distinct nxt.exercise_id as target_id, cur.exercise_id as from_id
    from public.skill_path_nodes cur
    join trained_unlocked tu on tu.exercise_id = cur.exercise_id
    join public.skill_path_nodes nxt
      on nxt.path_id = cur.path_id and nxt.position = cur.position + 1
    where not exists (
      select 1 from public.skill_unlocks su
      where su.user_id = v_user and su.exercise_id = nxt.exercise_id
    )
  ),
  ready as (
    select n.target_id
    from neighbours n
    join public.exercises e on e.id = n.target_id
    where e.unlock_criteria is not null
      and (
        (e.unlock_criteria->>'kind' = 'reps' and (
          select count(*) from logged l
          where l.exercise_id = n.from_id
            and l.reps >= (e.unlock_criteria->>'reps')::integer
        ) >= (e.unlock_criteria->>'sets')::integer)
        or
        (e.unlock_criteria->>'kind' = 'hold' and (
          select count(*) from logged l
          where l.exercise_id = n.from_id
            and l.seconds >= (e.unlock_criteria->>'seconds')::integer
        ) >= (e.unlock_criteria->>'sets')::integer)
      )
    group by n.target_id
  ),
  offered as (
    insert into public.skill_challenges (user_id, exercise_id, status, offered_workout_id, offered_at)
    select v_user, r.target_id, 'ready', v_workout_id, now() from ready r
    on conflict (user_id, exercise_id) do update
      set offered_workout_id = excluded.offered_workout_id,
          offered_at = now(),
          status = case
            when public.skill_challenges.status in ('declined', 'failed') then 'ready'
            else public.skill_challenges.status
          end
      where public.skill_challenges.offered_workout_id is distinct from excluded.offered_workout_id
    returning exercise_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'exercise_id', e.id, 'slug', e.slug, 'name', e.name,
           'criteria', e.unlock_criteria, 'demo_notes', e.demo_notes)), '[]'::jsonb)
  into v_challenges
  from offered o join public.exercises e on e.id = o.exercise_id;

  return jsonb_build_object(
    'workout_id', v_workout_id,
    'action', v_action,
    'xp', v_xp,
    'points', v_points,
    'streak_len', v_len,
    'multiplier', v_mult,
    'milestones', v_milestones,
    'reset', v_reset,
    'unlocks', v_unlocks,
    'prs', v_prs,
    'challenges', v_challenges
  );
end;
$$;
