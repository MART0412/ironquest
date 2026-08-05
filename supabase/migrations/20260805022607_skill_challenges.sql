-- Session 13 Part 2: challenge-based skill unlocks.
--
-- Unlocks stop being silent side-effects. When your logged numbers reach the
-- criteria of an adjacent locked node, complete_workout OFFERS a challenge; you
-- unlock that node by actually performing and logging ITS criteria via
-- attempt_challenge. Declining or failing leaves a persistent "Challenge Ready"
-- badge that stays attemptable from the node's detail sheet.
--
-- Fast-track (backlog B4): any locked node can be attempted directly; success
-- unlocks it at full XP and cascade-credits the skipped prior nodes in the paths
-- that contain it, at a reduced rate under a distinct ledger action.
--
-- Mirrors lib/game/challenges.ts (CASCADE_XP_RATE = 0.25). Keep in lockstep.

-- ---------------------------------------------------------------------------
-- 1. Challenge state, one row per (user, exercise).
--    Owner SELECT only: written exclusively by the definer functions, because
--    resolving a challenge awards XP (hard rule 6).
-- ---------------------------------------------------------------------------
create table public.skill_challenges (
  user_id            uuid not null references auth.users (id) on delete cascade,
  exercise_id        uuid not null references public.exercises (id) on delete cascade,
  status             text not null check (status in ('ready', 'declined', 'failed', 'completed')),
  offered_workout_id uuid references public.workouts (id) on delete set null,
  attempts           integer not null default 0,
  offered_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  primary key (user_id, exercise_id)
);

create index skill_challenges_user_status_idx
  on public.skill_challenges (user_id, status);

comment on table public.skill_challenges is 'Offered/attempted skill challenges. Written only by complete_workout / attempt_challenge / decline_challenge; clients are read-only by RLS design.';

alter table public.skill_challenges enable row level security;
create policy "Skill challenges: owner select"
  on public.skill_challenges for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Shared helper: unlock one exercise and write its ledger award, so the
--    award exists in exactly one place. Private (revoked from clients).
--    Returns null when the node was already unlocked — never double-awards.
-- ---------------------------------------------------------------------------
create or replace function public.award_skill_unlock(
  p_user     uuid,
  p_exercise uuid,
  p_workout  uuid,
  p_xp       integer,
  p_points   integer,
  p_action   text,
  p_today    date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.exercises%rowtype;
begin
  select * into v_row from public.exercises where id = p_exercise;
  if not found then
    return null;
  end if;

  if exists (
    select 1 from public.skill_unlocks
    where user_id = p_user and exercise_id = p_exercise
  ) then
    return null;
  end if;

  insert into public.skill_unlocks (user_id, exercise_id, evidence_workout_id)
  values (p_user, p_exercise, p_workout)
  on conflict (user_id, exercise_id) do nothing;

  insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
  values (p_user, p_action, p_xp, p_points, p_exercise, p_today);

  return jsonb_build_object(
    'exercise_id', v_row.id, 'slug', v_row.slug, 'name', v_row.name,
    'branch', v_row.branch, 'tier', v_row.tier, 'xp', p_xp,
    'cascaded', p_action = 'skill_unlock_cascade'
  );
end;
$$;

revoke execute on function public.award_skill_unlock(uuid, uuid, uuid, integer, integer, text, date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. complete_workout: unchanged awards/streak/PR/unlock behaviour, plus
--    readiness OFFERS for adjacent locked nodes.
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

  insert into public.workout_sets (workout_id, exercise_id, set_no, reps, seconds, rpe)
  select
    v_workout_id,
    (s->>'exercise_id')::uuid,
    (s->>'set_no')::integer,
    nullif(s->>'reps', '')::integer,
    nullif(s->>'seconds', '')::integer,
    nullif(s->>'rpe', '')::numeric
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

-- ---------------------------------------------------------------------------
-- 4. attempt_challenge — the evidence-based resolution.
--    Logs the attempt's sets against today's workout (creating one if needed)
--    and awards NO workout/bonus XP, so attempts can't farm the daily award and
--    don't touch the streak. Only skill unlocks are awarded here.
-- ---------------------------------------------------------------------------
create or replace function public.attempt_challenge(
  p_exercise_id uuid,
  p_sets jsonb default '[]',
  p_fast_track boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := auth.uid();
  v_today      date;
  v_ex         public.exercises%rowtype;
  v_workout_id uuid;
  v_offset     integer;
  v_met        boolean;
  v_mult       numeric;
  v_streak_len integer;
  v_prereq_ok  boolean;
  v_unlocks    jsonb := '[]'::jsonb;
  v_unlock     jsonb;
  v_cascade    record;
  v_casc_xp    integer;
  v_casc_pts   integer;
  v_skipped    integer := 0;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_ex from public.exercises where id = p_exercise_id;
  if not found or v_ex.unlock_criteria is null then
    raise exception 'exercise not challengeable';
  end if;

  perform 1 from public.streaks where user_id = v_user for update;

  v_today := (now() at time zone 'America/Mexico_City')::date;

  if exists (
    select 1 from public.skill_unlocks
    where user_id = v_user and exercise_id = p_exercise_id
  ) then
    raise exception 'already_unlocked';
  end if;

  -- Multiplier is only READ here: an attempt is not a workout completion, so it
  -- must not extend the streak or re-award milestones.
  select current_len into v_streak_len from public.streaks where user_id = v_user;
  v_mult := least(1.0 + 0.05 * floor(coalesce(v_streak_len, 0) / 7.0), 1.5);

  -- Prerequisite: satisfied in at least one containing path, unless fast-track.
  select exists (
    select 1 from public.skill_path_nodes n
    where n.exercise_id = p_exercise_id
      and (
        n.position = 1
        or exists (
          select 1 from public.skill_path_nodes prev
          join public.skill_unlocks su
            on su.exercise_id = prev.exercise_id and su.user_id = v_user
          where prev.path_id = n.path_id and prev.position = n.position - 1
        )
      )
  ) into v_prereq_ok;

  if not v_prereq_ok and not p_fast_track then
    raise exception 'prerequisite_not_met';
  end if;

  -- Evidence goes on today's workout (reuse the latest, else create one).
  select id into v_workout_id
  from public.workouts
  where user_id = v_user and date = v_today and status = 'completed'
  order by created_at desc limit 1;

  if v_workout_id is null then
    insert into public.workouts (user_id, date, status)
    values (v_user, v_today, 'completed')
    returning id into v_workout_id;
  end if;

  -- Offset set numbers past any existing sets for this exercise in that workout.
  select coalesce(max(set_no), 0) into v_offset
  from public.workout_sets
  where workout_id = v_workout_id and exercise_id = p_exercise_id;

  insert into public.workout_sets (workout_id, exercise_id, set_no, reps, seconds, rpe)
  select
    v_workout_id, p_exercise_id,
    v_offset + (s->>'set_no')::integer,
    nullif(s->>'reps', '')::integer,
    nullif(s->>'seconds', '')::integer,
    nullif(s->>'rpe', '')::numeric
  from jsonb_array_elements(p_sets) as s;

  -- Did the ATTEMPT's own sets meet this exercise's criteria?
  if v_ex.unlock_criteria->>'kind' = 'reps' then
    select count(*) >= (v_ex.unlock_criteria->>'sets')::integer into v_met
    from public.workout_sets
    where workout_id = v_workout_id and exercise_id = p_exercise_id
      and set_no > v_offset
      and reps >= (v_ex.unlock_criteria->>'reps')::integer;
  elsif v_ex.unlock_criteria->>'kind' = 'hold' then
    select count(*) >= (v_ex.unlock_criteria->>'sets')::integer into v_met
    from public.workout_sets
    where workout_id = v_workout_id and exercise_id = p_exercise_id
      and set_no > v_offset
      and seconds >= (v_ex.unlock_criteria->>'seconds')::integer;
  else
    v_met := false;
  end if;

  if not v_met then
    insert into public.skill_challenges (user_id, exercise_id, status, attempts, offered_at)
    values (v_user, p_exercise_id, 'failed', 1, now())
    on conflict (user_id, exercise_id) do update
      set status = 'failed',
          attempts = public.skill_challenges.attempts + 1,
          resolved_at = null;
    return jsonb_build_object(
      'unlocked', false, 'exercise_id', p_exercise_id, 'name', v_ex.name,
      'workout_id', v_workout_id, 'unlocks', '[]'::jsonb, 'cascaded', 0);
  end if;

  -- Success: unlock the target at full price.
  v_unlock := public.award_skill_unlock(
    v_user, p_exercise_id, v_workout_id,
    round(200 * v_mult)::integer, 25, 'skill_unlock', v_today);
  if v_unlock is not null then
    v_unlocks := v_unlocks || v_unlock;
  end if;

  -- Fast-track: credit the skipped earlier nodes, along the target's paths only.
  if p_fast_track then
    v_casc_xp := round(200 * 0.25 * v_mult)::integer;
    v_casc_pts := round(25 * 0.25)::integer;

    for v_cascade in
      select distinct prior.exercise_id
      from public.skill_path_nodes target
      join public.skill_path_nodes prior
        on prior.path_id = target.path_id and prior.position < target.position
      where target.exercise_id = p_exercise_id
        and not exists (
          select 1 from public.skill_unlocks su
          where su.user_id = v_user and su.exercise_id = prior.exercise_id
        )
    loop
      v_unlock := public.award_skill_unlock(
        v_user, v_cascade.exercise_id, v_workout_id,
        v_casc_xp, v_casc_pts, 'skill_unlock_cascade', v_today);
      if v_unlock is not null then
        v_unlocks := v_unlocks || v_unlock;
        v_skipped := v_skipped + 1;
        update public.skill_challenges
        set status = 'completed', resolved_at = now()
        where user_id = v_user and exercise_id = v_cascade.exercise_id;
      end if;
    end loop;
  end if;

  insert into public.skill_challenges (user_id, exercise_id, status, attempts, offered_at, resolved_at)
  values (v_user, p_exercise_id, 'completed', 1, now(), now())
  on conflict (user_id, exercise_id) do update
    set status = 'completed',
        attempts = public.skill_challenges.attempts + 1,
        resolved_at = now();

  return jsonb_build_object(
    'unlocked', true, 'exercise_id', p_exercise_id, 'name', v_ex.name,
    'workout_id', v_workout_id, 'unlocks', v_unlocks,
    'cascaded', v_skipped, 'multiplier', v_mult);
end;
$$;

revoke execute on function public.attempt_challenge(uuid, jsonb, boolean) from public, anon;
grant execute on function public.attempt_challenge(uuid, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. decline_challenge — persists the badge without awarding anything.
-- ---------------------------------------------------------------------------
create or replace function public.decline_challenge(p_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.skill_challenges (user_id, exercise_id, status, offered_at)
  values (v_user, p_exercise_id, 'declined', now())
  on conflict (user_id, exercise_id) do update
    set status = case
      when public.skill_challenges.status = 'completed' then 'completed'
      else 'declined'
    end;
end;
$$;

revoke execute on function public.decline_challenge(uuid) from public, anon;
grant execute on function public.decline_challenge(uuid) to authenticated;
