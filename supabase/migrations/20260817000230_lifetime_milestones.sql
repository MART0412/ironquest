-- Lifetime stats + real-world milestone equivalences (Session 14).
--
-- Nothing new is logged: every total here is a sum over workout_sets already
-- recorded, which is why the counters are retroactive over the whole history.
-- Crossing a threshold pays a small XP bounty through the usual server-side
-- path (rule 6) and is recorded once, so it can never re-fire.
--
-- The catalog below is DERIVED from lib/game/equivalences.ts, which stays the
-- single authoring surface for thresholds, conversions and copy. Adding a
-- milestone later is a config edit plus `npm run sync:milestones` — the numbers
-- live here only because SQL has to be the one deciding the award.

-- ---------------------------------------------------------------------------
-- 1. How each exercise counts. One column keeps SQL and the app agreeing on
--    what "a pull-up" is; customs stay null and count only toward holds.
-- ---------------------------------------------------------------------------
alter table public.exercises
  add column movement_family text
    check (movement_family is null or movement_family in
      ('pull', 'push', 'press', 'dip', 'squat', 'core', 'other'));

comment on column public.exercises.movement_family is 'Groups exercises for lifetime totals (FAMILY_SLUGS in lib/game/equivalences.ts). Null for customs and for movements that feed no rep counter.';

update public.exercises set movement_family = 'pull'
  where slug in ('negative-pull-up', 'pull-up', 'chest-to-bar-pull-up', 'archer-pull-up', 'muscle-up', 'one-arm-negative', 'assisted-one-arm-pull-up', 'one-arm-pull-up', 'high-pull');

update public.exercises set movement_family = 'push'
  where slug in ('wall-push-up', 'incline-push-up', 'push-up', 'diamond-push-up', 'archer-push-up', 'pseudo-planche-push-up', 'one-arm-push-up');

update public.exercises set movement_family = 'press'
  where slug in ('pike-push-up', 'elevated-pike-push-up', 'wall-handstand-push-up', 'freestanding-hspu');

update public.exercises set movement_family = 'dip'
  where slug in ('straight-bar-dip');

update public.exercises set movement_family = 'squat'
  where slug in ('squat', 'split-squat', 'bulgarian-split-squat', 'archer-squat', 'shrimp-squat', 'assisted-pistol-squat', 'pistol-squat', 'elevated-pistol-squat');

update public.exercises set movement_family = 'core'
  where slug in ('hanging-knee-raise', 'toes-to-bar', 'dragon-flag');

create index exercises_movement_family_idx
  on public.exercises (movement_family) where movement_family is not null;

-- ---------------------------------------------------------------------------
-- 2. The milestone catalog — numbers only, world-readable, never client-written.
-- ---------------------------------------------------------------------------
create table public.equivalence_milestones (
  id         text primary key,
  metric     text not null,
  threshold  numeric not null check (threshold > 0),
  xp         integer not null default 0 check (xp >= 0),
  points     integer not null default 0 check (points >= 0),
  sort_order integer not null default 0
);

comment on table public.equivalence_milestones is 'Derived cache of lib/game/equivalences.ts, kept in step by scripts/sync-milestones.mjs. Adding a milestone is a config edit, not a migration.';

alter table public.equivalence_milestones enable row level security;
create policy "Equivalence milestones: readable by everyone"
  on public.equivalence_milestones for select using (true);

insert into public.equivalence_milestones (id, metric, threshold, xp, points, sort_order)
values
  ('pull_castillo', 'pull_reps', 60, 50, 5, 0),
  ('pull_angel', 'pull_reps', 90, 50, 5, 1),
  ('pull_thirty_storeys', 'pull_reps', 200, 75, 8, 2),
  ('pull_latino', 'pull_reps', 366, 100, 10, 3),
  ('pull_eiffel', 'pull_reps', 600, 100, 10, 4),
  ('pull_one_wtc', 'pull_reps', 1082, 150, 15, 5),
  ('pull_el_capitan', 'pull_reps', 1828, 150, 15, 6),
  ('push_vocho', 'push_reps', 20, 50, 5, 100),
  ('push_pickup', 'push_reps', 100, 50, 5, 101),
  ('push_bus', 'push_reps', 250, 75, 8, 102),
  ('push_semi', 'push_reps', 750, 100, 10, 103),
  ('push_737', 'push_reps', 2000, 150, 15, 104),
  ('squat_ten_floors', 'squat_reps', 80, 50, 5, 200),
  ('squat_torre_mayor', 'squat_reps', 440, 75, 8, 201),
  ('squat_empire', 'squat_reps', 816, 100, 10, 202),
  ('squat_burj', 'squat_reps', 1304, 150, 15, 203),
  ('hold_metro', 'hold_seconds', 600, 50, 5, 300),
  ('hold_episode', 'hold_seconds', 1800, 75, 8, 301),
  ('hold_hour', 'hold_seconds', 3600, 100, 10, 302),
  ('hold_flight', 'hold_seconds', 10800, 150, 15, 303),
  ('workouts_10', 'workouts', 10, 50, 5, 400),
  ('workouts_50', 'workouts', 50, 75, 8, 401),
  ('workouts_100', 'workouts', 100, 100, 10, 402),
  ('workouts_200', 'workouts', 200, 100, 10, 403),
  ('workouts_365', 'workouts', 365, 150, 15, 404)
on conflict (id) do update
  set metric = excluded.metric,
      threshold = excluded.threshold,
      xp = excluded.xp,
      points = excluded.points,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 3. What each user has crossed. Written only by the definer path, because
--    crossing pays XP; the primary key is what makes a re-fire impossible.
-- ---------------------------------------------------------------------------
create table public.user_milestones (
  user_id      uuid not null references auth.users (id) on delete cascade,
  milestone_id text not null references public.equivalence_milestones (id) on delete cascade,
  value_at     numeric not null,
  xp_awarded   integer not null default 0,
  awarded_at   timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

create index user_milestones_user_awarded_idx
  on public.user_milestones (user_id, awarded_at desc);

comment on table public.user_milestones is 'Equivalence milestones a user has crossed. xp_awarded = 0 means it was already true before this feature existed: recorded so it never re-fires, deliberately not back-paid.';

alter table public.user_milestones enable row level security;
create policy "User milestones: owner select"
  on public.user_milestones for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Lifetime totals — the same aggregation /stats shows, over completed
--    workouts only. Rep metrics count their own family; holds count every
--    exercise, because time under tension is time under tension.
-- ---------------------------------------------------------------------------
create or replace function public.lifetime_totals(p_user uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'pull_reps',    coalesce(sum(ws.reps)    filter (where e.movement_family = 'pull'), 0),
    'push_reps',    coalesce(sum(ws.reps)    filter (where e.movement_family = 'push'), 0),
    'press_reps',   coalesce(sum(ws.reps)    filter (where e.movement_family = 'press'), 0),
    'dip_reps',     coalesce(sum(ws.reps)    filter (where e.movement_family = 'dip'), 0),
    'squat_reps',   coalesce(sum(ws.reps)    filter (where e.movement_family = 'squat'), 0),
    'core_reps',    coalesce(sum(ws.reps)    filter (where e.movement_family = 'core'), 0),
    'hold_seconds', coalesce(sum(ws.seconds), 0),
    'workouts', (
      select count(*) from public.workouts w2
      where w2.user_id = p_user and w2.status = 'completed'
    )
  )
  from public.workout_sets ws
  join public.workouts w on w.id = ws.workout_id
  join public.exercises e on e.id = ws.exercise_id
  where w.user_id = p_user and w.status = 'completed';
$$;

revoke execute on function public.lifetime_totals(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Award the crossings. Compares a snapshot taken before the new sets landed
--    against the totals now:
--      * already past the threshold back then → recorded silently at 0 XP
--        (history predates the feature and is not back-paid)
--      * crossed just now                     → paid, and returned to celebrate
--    Private helper, same shape as award_skill_unlock.
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_milestones(
  p_user uuid,
  p_before jsonb,
  p_workout uuid,
  p_mult numeric,
  p_today date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_after   jsonb;
  v_row     record;
  v_now     numeric;
  v_then    numeric;
  v_xp      integer;
  v_awarded jsonb := '[]'::jsonb;
begin
  v_after := public.lifetime_totals(p_user);

  for v_row in
    select c.id, c.metric, c.threshold, c.xp, c.points
    from public.equivalence_milestones c
    where not exists (
      select 1 from public.user_milestones um
      where um.user_id = p_user and um.milestone_id = c.id
    )
    order by c.sort_order
  loop
    v_now := coalesce((v_after->>v_row.metric)::numeric, 0);
    if v_now < v_row.threshold then
      continue;
    end if;

    v_then := coalesce((p_before->>v_row.metric)::numeric, 0);

    if v_then >= v_row.threshold then
      insert into public.user_milestones (user_id, milestone_id, value_at, xp_awarded)
      values (p_user, v_row.id, v_now, 0)
      on conflict do nothing;
      continue;
    end if;

    v_xp := round(v_row.xp * coalesce(p_mult, 1))::integer;

    insert into public.user_milestones (user_id, milestone_id, value_at, xp_awarded)
    values (p_user, v_row.id, v_now, v_xp)
    on conflict do nothing;

    insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
    values (p_user, 'equivalence_milestone', v_xp, v_row.points, p_workout, p_today);

    v_awarded := v_awarded || jsonb_build_object(
      'milestone_id', v_row.id,
      'metric', v_row.metric,
      'threshold', v_row.threshold,
      'value', v_now,
      'xp', v_xp,
      'points', v_row.points);
  end loop;

  return v_awarded;
end;
$$;

revoke execute on function public.evaluate_milestones(uuid, jsonb, uuid, numeric, date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. complete_workout: unchanged behaviour, plus the milestone evaluation.
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
  v_equivalences      jsonb := '[]'::jsonb;
  v_before            jsonb;
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

  -- Lifetime snapshot taken before this workout exists, so evaluate_milestones
  -- can tell a threshold crossed *today* from one crossed long ago.
  v_before := public.lifetime_totals(v_user);

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

  -- Real-world equivalences: everything this workout pushed past a threshold.
  v_equivalences := public.evaluate_milestones(v_user, v_before, v_workout_id, v_mult, v_today);

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
    'challenges', v_challenges,
    'equivalences', v_equivalences
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. attempt_challenge: the same, so reps logged inside a challenge pay their
--    crossing now instead of being read as history by the next workout.
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
  v_equivalences jsonb := '[]'::jsonb;
  v_before       jsonb;
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

  -- Snapshot before the attempt touches anything — it may create today's
  -- workout as well as add reps, and both feed lifetime totals.
  v_before := public.lifetime_totals(v_user);

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
    -- A failed attempt is still training: its reps count toward equivalences.
    v_equivalences := public.evaluate_milestones(v_user, v_before, v_workout_id, v_mult, v_today);
    return jsonb_build_object(
      'unlocked', false, 'exercise_id', p_exercise_id, 'name', v_ex.name,
      'workout_id', v_workout_id, 'unlocks', '[]'::jsonb, 'cascaded', 0,
      'equivalences', v_equivalences);
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

  v_equivalences := public.evaluate_milestones(v_user, v_before, v_workout_id, v_mult, v_today);

  return jsonb_build_object(
    'unlocked', true, 'exercise_id', p_exercise_id, 'name', v_ex.name,
    'workout_id', v_workout_id, 'unlocks', v_unlocks,
    'cascaded', v_skipped, 'multiplier', v_mult,
    'equivalences', v_equivalences);
end;
$$;

revoke execute on function public.attempt_challenge(uuid, jsonb, boolean) from public, anon;
grant execute on function public.attempt_challenge(uuid, jsonb, boolean) to authenticated;
