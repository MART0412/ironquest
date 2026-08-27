-- Running & cycling progression content (Phase 3, slice 3).
--
-- Running and cycling could be logged but had no game: nothing to unlock and no
-- radar. This seeds six ladders (37 nodes) whose criteria are read from logged
-- SESSIONS rather than sets, and teaches log_activity to award them.
--
-- Mirrors lib/game/endurance-paths.ts, which stays the authoring surface for
-- the content, and the three new criteria kinds in lib/game/skills.ts.

-- ---------------------------------------------------------------------------
-- 1. Endurance nodes group by what they measure, not by muscle group.
-- ---------------------------------------------------------------------------
alter table public.exercises drop constraint if exists exercises_branch_check;
alter table public.exercises add constraint exercises_branch_check
  check (branch in ('push', 'pull', 'core', 'legs', 'static',
                    'distance', 'pace', 'consistency'));

comment on column public.exercises.branch is 'Grouping within a discipline: muscle group for calisthenics, measured quality (distance/pace/consistency) for endurance.';

-- ---------------------------------------------------------------------------
-- 2. The content. movement_family stays null throughout: a run is not reps,
--    and must never touch the lifetime rep counters.
-- ---------------------------------------------------------------------------
-- Exercises (one row per node).
insert into public.exercises (slug, name, branch, tier, unlock_criteria, demo_notes, discipline_id) values
  ('run-1k', 'First Kilometre', 'distance', 1, '{"kind":"distance","activities":["run","jog"],"km":1,"description":"One session of 1 km or more"}'::jsonb, 'Everyone starts here. One kilometre, all at once.', (select id from public.disciplines where slug = 'running')),
  ('run-5k', 'The Five', 'distance', 2, '{"kind":"distance","activities":["run","jog"],"km":5,"description":"One session of 5 km or more"}'::jsonb, 'The classic distance. Most runners'' bread and butter.', (select id from public.disciplines where slug = 'running')),
  ('run-10k', 'The Ten', 'distance', 3, '{"kind":"distance","activities":["run","jog"],"km":10,"description":"One session of 10 km or more"}'::jsonb, 'Double figures — the first distance that needs a plan.', (select id from public.disciplines where slug = 'running')),
  ('run-15k', 'The Fifteen', 'distance', 4, '{"kind":"distance","activities":["run","jog"],"km":15,"description":"One session of 15 km or more"}'::jsonb, 'Past the ten, into the long-run territory.', (select id from public.disciplines where slug = 'running')),
  ('run-half', 'Half Marathon', 'distance', 5, '{"kind":"distance","activities":["run","jog"],"km":21.1,"description":"One session of 21.1 km or more"}'::jsonb, '21.1 km. A serious morning''s work.', (select id from public.disciplines where slug = 'running')),
  ('run-30k', 'The Thirty', 'distance', 6, '{"kind":"distance","activities":["run","jog"],"km":30,"description":"One session of 30 km or more"}'::jsonb, 'The wall lives around here. Meet it.', (select id from public.disciplines where slug = 'running')),
  ('run-marathon', 'Marathon', 'distance', 7, '{"kind":"distance","activities":["run","jog"],"km":42.2,"description":"One session of 42.2 km or more"}'::jsonb, '42.2 km. The distance that made the sport.', (select id from public.disciplines where slug = 'running')),
  ('run-pace-700', 'Steady Five', 'pace', 1, '{"kind":"pace","activities":["run","jog"],"minKm":5,"maxPacePerKm":7,"description":"5 km at 7:00 /km or faster"}'::jsonb, 'Five kilometres held at 7:00 per kilometre or faster.', (select id from public.disciplines where slug = 'running')),
  ('run-pace-620', 'Sub-32 Five', 'pace', 2, '{"kind":"pace","activities":["run","jog"],"minKm":5,"maxPacePerKm":6.333333333333333,"description":"5 km at 6:20 /km or faster"}'::jsonb, 'Five kilometres held at 6:20 per kilometre or faster.', (select id from public.disciplines where slug = 'running')),
  ('run-pace-600', 'Sub-30 Five', 'pace', 3, '{"kind":"pace","activities":["run","jog"],"minKm":5,"maxPacePerKm":6,"description":"5 km at 6:00 /km or faster"}'::jsonb, 'Five kilometres held at 6:00 per kilometre or faster.', (select id from public.disciplines where slug = 'running')),
  ('run-pace-530', 'Sub-27 Five', 'pace', 4, '{"kind":"pace","activities":["run","jog"],"minKm":5,"maxPacePerKm":5.5,"description":"5 km at 5:30 /km or faster"}'::jsonb, 'Five kilometres held at 5:30 per kilometre or faster.', (select id from public.disciplines where slug = 'running')),
  ('run-pace-500', 'Sub-25 Five', 'pace', 5, '{"kind":"pace","activities":["run","jog"],"minKm":5,"maxPacePerKm":5,"description":"5 km at 5:00 /km or faster"}'::jsonb, 'Five kilometres held at 5:00 per kilometre or faster.', (select id from public.disciplines where slug = 'running')),
  ('run-pace-430', 'Sub-22 Five', 'pace', 6, '{"kind":"pace","activities":["run","jog"],"minKm":5,"maxPacePerKm":4.5,"description":"5 km at 4:30 /km or faster"}'::jsonb, 'Five kilometres held at 4:30 per kilometre or faster.', (select id from public.disciplines where slug = 'running')),
  ('run-pace-400', 'Sub-20 Five', 'pace', 7, '{"kind":"pace","activities":["run","jog"],"minKm":5,"maxPacePerKm":4,"description":"5 km at 4:00 /km or faster"}'::jsonb, 'Five kilometres held at 4:00 per kilometre or faster.', (select id from public.disciplines where slug = 'running')),
  ('run-freq-2w', 'Twice in a Week', 'consistency', 1, '{"kind":"frequency","activities":["run","jog"],"count":2,"windowDays":7,"description":"2 runs in 7 days"}'::jsonb, 'Showing up is the skill. 2 runs inside 7 days.', (select id from public.disciplines where slug = 'running')),
  ('run-freq-10m', 'Ten in a Month', 'consistency', 2, '{"kind":"frequency","activities":["run","jog"],"count":10,"windowDays":30,"description":"10 runs in 30 days"}'::jsonb, 'Showing up is the skill. 10 runs inside 30 days.', (select id from public.disciplines where slug = 'running')),
  ('run-freq-3w', 'Three in a Week', 'consistency', 3, '{"kind":"frequency","activities":["run","jog"],"count":3,"windowDays":7,"description":"3 runs in 7 days"}'::jsonb, 'Showing up is the skill. 3 runs inside 7 days.', (select id from public.disciplines where slug = 'running')),
  ('run-freq-15m', 'Fifteen in a Month', 'consistency', 4, '{"kind":"frequency","activities":["run","jog"],"count":15,"windowDays":30,"description":"15 runs in 30 days"}'::jsonb, 'Showing up is the skill. 15 runs inside 30 days.', (select id from public.disciplines where slug = 'running')),
  ('run-freq-4w', 'Four in a Week', 'consistency', 5, '{"kind":"frequency","activities":["run","jog"],"count":4,"windowDays":7,"description":"4 runs in 7 days"}'::jsonb, 'Showing up is the skill. 4 runs inside 7 days.', (select id from public.disciplines where slug = 'running')),
  ('run-freq-20m', 'Twenty in a Month', 'consistency', 6, '{"kind":"frequency","activities":["run","jog"],"count":20,"windowDays":30,"description":"20 runs in 30 days"}'::jsonb, 'Showing up is the skill. 20 runs inside 30 days.', (select id from public.disciplines where slug = 'running')),
  ('ride-5k', 'First Five', 'distance', 1, '{"kind":"distance","activities":["cycling-moderate","cycling-vigorous"],"km":5,"description":"One session of 5 km or more"}'::jsonb, 'Round the block, but properly.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-20k', 'The Twenty', 'distance', 2, '{"kind":"distance","activities":["cycling-moderate","cycling-vigorous"],"km":20,"description":"One session of 20 km or more"}'::jsonb, 'An hour in the saddle for most riders.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-40k', 'The Forty', 'distance', 3, '{"kind":"distance","activities":["cycling-moderate","cycling-vigorous"],"km":40,"description":"One session of 40 km or more"}'::jsonb, 'The classic time-trial distance.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-50k', 'Metric Half Century', 'distance', 4, '{"kind":"distance","activities":["cycling-moderate","cycling-vigorous"],"km":50,"description":"One session of 50 km or more"}'::jsonb, 'Fifty kilometres. A proper Sunday.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-100k', 'Metric Century', 'distance', 5, '{"kind":"distance","activities":["cycling-moderate","cycling-vigorous"],"km":100,"description":"One session of 100 km or more"}'::jsonb, '100 km. The ride cyclists actually brag about.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-160k', 'Imperial Century', 'distance', 6, '{"kind":"distance","activities":["cycling-moderate","cycling-vigorous"],"km":160,"description":"One session of 160 km or more"}'::jsonb, '100 miles. A very long day.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-speed-20', 'Twenty at Twenty', 'pace', 1, '{"kind":"pace","activities":["cycling-moderate","cycling-vigorous"],"minKm":20,"maxPacePerKm":3,"description":"20 km at 20 km/h or faster"}'::jsonb, 'Twenty kilometres averaging 20 km/h or better.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-speed-23', 'Twenty-Three', 'pace', 2, '{"kind":"pace","activities":["cycling-moderate","cycling-vigorous"],"minKm":20,"maxPacePerKm":2.608695652173913,"description":"20 km at 23 km/h or faster"}'::jsonb, 'Twenty kilometres averaging 23 km/h or better.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-speed-26', 'Twenty-Six', 'pace', 3, '{"kind":"pace","activities":["cycling-moderate","cycling-vigorous"],"minKm":20,"maxPacePerKm":2.3076923076923075,"description":"20 km at 26 km/h or faster"}'::jsonb, 'Twenty kilometres averaging 26 km/h or better.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-speed-29', 'Twenty-Nine', 'pace', 4, '{"kind":"pace","activities":["cycling-moderate","cycling-vigorous"],"minKm":20,"maxPacePerKm":2.0689655172413794,"description":"20 km at 29 km/h or faster"}'::jsonb, 'Twenty kilometres averaging 29 km/h or better.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-speed-32', 'Thirty-Two', 'pace', 5, '{"kind":"pace","activities":["cycling-moderate","cycling-vigorous"],"minKm":20,"maxPacePerKm":1.875,"description":"20 km at 32 km/h or faster"}'::jsonb, 'Twenty kilometres averaging 32 km/h or better.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-freq-2w', 'Twice in a Week', 'consistency', 1, '{"kind":"frequency","activities":["cycling-moderate","cycling-vigorous"],"count":2,"windowDays":7,"description":"2 rides in 7 days"}'::jsonb, 'Showing up is the skill. 2 rides inside 7 days.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-freq-10m', 'Ten in a Month', 'consistency', 2, '{"kind":"frequency","activities":["cycling-moderate","cycling-vigorous"],"count":10,"windowDays":30,"description":"10 rides in 30 days"}'::jsonb, 'Showing up is the skill. 10 rides inside 30 days.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-freq-3w', 'Three in a Week', 'consistency', 3, '{"kind":"frequency","activities":["cycling-moderate","cycling-vigorous"],"count":3,"windowDays":7,"description":"3 rides in 7 days"}'::jsonb, 'Showing up is the skill. 3 rides inside 7 days.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-freq-15m', 'Fifteen in a Month', 'consistency', 4, '{"kind":"frequency","activities":["cycling-moderate","cycling-vigorous"],"count":15,"windowDays":30,"description":"15 rides in 30 days"}'::jsonb, 'Showing up is the skill. 15 rides inside 30 days.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-freq-4w', 'Four in a Week', 'consistency', 5, '{"kind":"frequency","activities":["cycling-moderate","cycling-vigorous"],"count":4,"windowDays":7,"description":"4 rides in 7 days"}'::jsonb, 'Showing up is the skill. 4 rides inside 7 days.', (select id from public.disciplines where slug = 'cycling')),
  ('ride-freq-20m', 'Twenty in a Month', 'consistency', 6, '{"kind":"frequency","activities":["cycling-moderate","cycling-vigorous"],"count":20,"windowDays":30,"description":"20 rides in 30 days"}'::jsonb, 'Showing up is the skill. 20 rides inside 30 days.', (select id from public.disciplines where slug = 'cycling'));

-- Paths, with their capstone as the signature exercise.
insert into public.skill_paths (slug, name, signature_exercise_id, display_order, discipline_id) values
  ('running-distance', 'Distance Path', (select id from public.exercises where slug = 'run-marathon'), 100, (select id from public.disciplines where slug = 'running')),
  ('running-pace', 'Pace Path', (select id from public.exercises where slug = 'run-pace-400'), 101, (select id from public.disciplines where slug = 'running')),
  ('running-consistency', 'Consistency Path', (select id from public.exercises where slug = 'run-freq-20m'), 102, (select id from public.disciplines where slug = 'running')),
  ('cycling-distance', 'Distance Path', (select id from public.exercises where slug = 'ride-160k'), 103, (select id from public.disciplines where slug = 'cycling')),
  ('cycling-speed', 'Speed Path', (select id from public.exercises where slug = 'ride-speed-32'), 104, (select id from public.disciplines where slug = 'cycling')),
  ('cycling-consistency', 'Consistency Path', (select id from public.exercises where slug = 'ride-freq-20m'), 105, (select id from public.disciplines where slug = 'cycling'));

-- Path membership, in ladder order.
insert into public.skill_path_nodes (path_id, exercise_id, position) values
  ((select id from public.skill_paths where slug = 'running-distance'), (select id from public.exercises where slug = 'run-1k'), 1),
  ((select id from public.skill_paths where slug = 'running-distance'), (select id from public.exercises where slug = 'run-5k'), 2),
  ((select id from public.skill_paths where slug = 'running-distance'), (select id from public.exercises where slug = 'run-10k'), 3),
  ((select id from public.skill_paths where slug = 'running-distance'), (select id from public.exercises where slug = 'run-15k'), 4),
  ((select id from public.skill_paths where slug = 'running-distance'), (select id from public.exercises where slug = 'run-half'), 5),
  ((select id from public.skill_paths where slug = 'running-distance'), (select id from public.exercises where slug = 'run-30k'), 6),
  ((select id from public.skill_paths where slug = 'running-distance'), (select id from public.exercises where slug = 'run-marathon'), 7),
  ((select id from public.skill_paths where slug = 'running-pace'), (select id from public.exercises where slug = 'run-pace-700'), 1),
  ((select id from public.skill_paths where slug = 'running-pace'), (select id from public.exercises where slug = 'run-pace-620'), 2),
  ((select id from public.skill_paths where slug = 'running-pace'), (select id from public.exercises where slug = 'run-pace-600'), 3),
  ((select id from public.skill_paths where slug = 'running-pace'), (select id from public.exercises where slug = 'run-pace-530'), 4),
  ((select id from public.skill_paths where slug = 'running-pace'), (select id from public.exercises where slug = 'run-pace-500'), 5),
  ((select id from public.skill_paths where slug = 'running-pace'), (select id from public.exercises where slug = 'run-pace-430'), 6),
  ((select id from public.skill_paths where slug = 'running-pace'), (select id from public.exercises where slug = 'run-pace-400'), 7),
  ((select id from public.skill_paths where slug = 'running-consistency'), (select id from public.exercises where slug = 'run-freq-2w'), 1),
  ((select id from public.skill_paths where slug = 'running-consistency'), (select id from public.exercises where slug = 'run-freq-10m'), 2),
  ((select id from public.skill_paths where slug = 'running-consistency'), (select id from public.exercises where slug = 'run-freq-3w'), 3),
  ((select id from public.skill_paths where slug = 'running-consistency'), (select id from public.exercises where slug = 'run-freq-15m'), 4),
  ((select id from public.skill_paths where slug = 'running-consistency'), (select id from public.exercises where slug = 'run-freq-4w'), 5),
  ((select id from public.skill_paths where slug = 'running-consistency'), (select id from public.exercises where slug = 'run-freq-20m'), 6),
  ((select id from public.skill_paths where slug = 'cycling-distance'), (select id from public.exercises where slug = 'ride-5k'), 1),
  ((select id from public.skill_paths where slug = 'cycling-distance'), (select id from public.exercises where slug = 'ride-20k'), 2),
  ((select id from public.skill_paths where slug = 'cycling-distance'), (select id from public.exercises where slug = 'ride-40k'), 3),
  ((select id from public.skill_paths where slug = 'cycling-distance'), (select id from public.exercises where slug = 'ride-50k'), 4),
  ((select id from public.skill_paths where slug = 'cycling-distance'), (select id from public.exercises where slug = 'ride-100k'), 5),
  ((select id from public.skill_paths where slug = 'cycling-distance'), (select id from public.exercises where slug = 'ride-160k'), 6),
  ((select id from public.skill_paths where slug = 'cycling-speed'), (select id from public.exercises where slug = 'ride-speed-20'), 1),
  ((select id from public.skill_paths where slug = 'cycling-speed'), (select id from public.exercises where slug = 'ride-speed-23'), 2),
  ((select id from public.skill_paths where slug = 'cycling-speed'), (select id from public.exercises where slug = 'ride-speed-26'), 3),
  ((select id from public.skill_paths where slug = 'cycling-speed'), (select id from public.exercises where slug = 'ride-speed-29'), 4),
  ((select id from public.skill_paths where slug = 'cycling-speed'), (select id from public.exercises where slug = 'ride-speed-32'), 5),
  ((select id from public.skill_paths where slug = 'cycling-consistency'), (select id from public.exercises where slug = 'ride-freq-2w'), 1),
  ((select id from public.skill_paths where slug = 'cycling-consistency'), (select id from public.exercises where slug = 'ride-freq-10m'), 2),
  ((select id from public.skill_paths where slug = 'cycling-consistency'), (select id from public.exercises where slug = 'ride-freq-3w'), 3),
  ((select id from public.skill_paths where slug = 'cycling-consistency'), (select id from public.exercises where slug = 'ride-freq-15m'), 4),
  ((select id from public.skill_paths where slug = 'cycling-consistency'), (select id from public.exercises where slug = 'ride-freq-4w'), 5),
  ((select id from public.skill_paths where slug = 'cycling-consistency'), (select id from public.exercises where slug = 'ride-freq-20m'), 6);

-- ---------------------------------------------------------------------------
-- 3. Criteria evaluation. Distance and pace are judged on the ONE session --
--    a week of short runs is not a 10 km run. Frequency is judged across its
--    rolling window, which is the whole point of it.
--    Mirrors meetsEnduranceCriteria in lib/game/skills.ts.
-- ---------------------------------------------------------------------------
create or replace function public.endurance_criteria_met(
  p_user uuid,
  p_criteria jsonb,
  p_workout uuid,
  p_today date
)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_kind    text := p_criteria->>'kind';
  v_session public.workouts%rowtype;
  v_count   integer;
begin
  if v_kind not in ('distance', 'pace', 'frequency') then
    return false;
  end if;

  if v_kind = 'frequency' then
    select count(*) into v_count
    from public.workouts w
    where w.user_id = p_user
      and w.status = 'completed'
      and w.activity_slug is not null
      and exists (
        select 1 from jsonb_array_elements_text(p_criteria->'activities') a
        where a = w.activity_slug
      )
      and w.date > p_today - (p_criteria->>'windowDays')::integer
      and w.date <= p_today;
    return v_count >= (p_criteria->>'count')::integer;
  end if;

  select * into v_session from public.workouts where id = p_workout;
  if not found or v_session.activity_slug is null then
    return false;
  end if;

  if not exists (
    select 1 from jsonb_array_elements_text(p_criteria->'activities') a
    where a = v_session.activity_slug
  ) then
    return false;
  end if;

  if v_kind = 'distance' then
    return coalesce(v_session.distance_km, 0) >= (p_criteria->>'km')::numeric;
  end if;

  -- pace: far enough to count, and quick enough over that distance.
  if coalesce(v_session.distance_km, 0) < (p_criteria->>'minKm')::numeric then
    return false;
  end if;
  if coalesce(v_session.duration_min, 0) <= 0 then
    return false;
  end if;
  return (v_session.duration_min::numeric / v_session.distance_km)
    <= (p_criteria->>'maxPacePerKm')::numeric;
end;
$$;

revoke execute on function public.endurance_criteria_met(uuid, jsonb, uuid, date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. log_activity, now awarding the ladders it clears.
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(
  p_activity_slug text,
  p_duration_min integer,
  p_distance_km numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user          uuid := auth.uid();
  v_xp_per_metmin constant numeric := 0.35;  -- ACTIVITY_XP.XP_PER_MET_MINUTE
  v_daily_cap     constant integer := 150;   -- ACTIVITY_XP.DAILY_CAP
  v_streak_min    constant integer := 10;    -- ACTIVITY_XP.STREAK_MIN_MINUTES
  v_activity      public.activities%rowtype;
  v_today         date;
  v_workout_id    uuid;
  v_kind          text;
  v_spent         integer;
  v_proposed      integer;
  v_awarded       integer;
  v_points        integer;
  v_capped        boolean;
  v_qualifies     boolean;
  v_len           integer;
  v_mult          numeric;
  v_milestones    integer;
  v_reset         boolean;
  v_before        jsonb;
  v_equivalences  jsonb := '[]'::jsonb;
  v_unlocks       jsonb := '[]'::jsonb;
  v_unlock        jsonb;
  v_path          record;
  v_node          record;
  v_deepest       integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_activity from public.activities where slug = p_activity_slug;
  if not found then
    raise exception 'unknown_activity';
  end if;

  if p_duration_min is null or p_duration_min < 1 or p_duration_min > 600 then
    raise exception 'invalid_duration';
  end if;

  perform 1 from public.streaks where user_id = v_user for update;

  v_today := (now() at time zone 'America/Mexico_City')::date;
  v_kind := case when v_activity.kind = 'endurance' then 'endurance' else 'activity' end;

  -- Snapshot lifetime totals before this session exists, so a milestone the
  -- session itself crosses is paid rather than read as history.
  v_before := public.lifetime_totals(v_user);

  insert into public.workouts (
    user_id, date, status, kind, activity_slug, duration_min, distance_km, notes)
  values (
    v_user, v_today, 'completed', v_kind, v_activity.slug, p_duration_min,
    p_distance_km, nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into v_workout_id;

  -- A qualifying session is a streak day on exactly the same rules as a
  -- workout; a token few minutes is logged but holds nothing together.
  v_qualifies := p_duration_min >= v_streak_min;

  select * into v_len, v_mult, v_milestones, v_reset
  from public.evaluate_streak_and_award(v_user, v_today, v_qualifies, v_workout_id);

  -- Duration x intensity, then trimmed to what today has left.
  v_proposed := round(v_activity.met * p_duration_min * v_xp_per_metmin * v_mult)::integer;

  select coalesce(sum(xp), 0) into v_spent
  from public.xp_ledger
  where user_id = v_user
    and action = 'activity_session'
    and (ts at time zone 'America/Mexico_City')::date = v_today;

  v_awarded := greatest(0, least(v_proposed, v_daily_cap - v_spent));
  v_capped := v_awarded < v_proposed;
  -- Points are a tenth of what was actually AWARDED, de-multiplied so a streak
  -- can't inflate them. Deriving them from the award (not the proposal) is what
  -- makes the daily cap trim points as well as XP.
  v_points := case
    when v_awarded = 0 then 0
    else greatest(0, round((v_awarded / greatest(v_mult, 0.01)) / 10))::integer
  end;

  if v_awarded > 0 then
    insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
    values (v_user, 'activity_session', v_awarded, v_points, v_workout_id, v_today);
    update public.workouts set xp_awarded = v_awarded where id = v_workout_id;
  end if;


  -- -------------------------------------------------------------------------
  -- Endurance unlocks. A logged session is the evidence, exactly as a logged
  -- set is for calisthenics. Every node this session clears is unlocked; the
  -- deepest at full price and the ones it skipped at the cascade rate, because
  -- if you just ran a marathon you have demonstrably covered five kilometres.
  -- Only disciplines the user actually trains are considered.
  -- -------------------------------------------------------------------------
  for v_path in
    select distinct sp.id as path_id
    from public.skill_paths sp
    join public.skill_path_nodes spn on spn.path_id = sp.id
    join public.exercises e on e.id = spn.exercise_id
    join public.user_disciplines ud
      on ud.discipline_id = sp.discipline_id and ud.user_id = v_user
    where e.unlock_criteria->>'kind' in ('distance', 'pace', 'frequency')
      and exists (
        select 1
        from jsonb_array_elements_text(e.unlock_criteria->'activities') a
        where a = v_activity.slug
      )
  loop
    -- How far up this ladder the session reaches.
    v_deepest := 0;
    for v_node in
      select spn.position, e.unlock_criteria
      from public.skill_path_nodes spn
      join public.exercises e on e.id = spn.exercise_id
      where spn.path_id = v_path.path_id
      order by spn.position
    loop
      if public.endurance_criteria_met(
        v_user, v_node.unlock_criteria, v_workout_id, v_today) then
        v_deepest := v_node.position;
      end if;
    end loop;

    if v_deepest > 0 then
      for v_node in
        select spn.position, e.id
        from public.skill_path_nodes spn
        join public.exercises e on e.id = spn.exercise_id
        where spn.path_id = v_path.path_id and spn.position <= v_deepest
        order by spn.position
      loop
        if v_node.position = v_deepest then
          v_unlock := public.award_skill_unlock(
            v_user, v_node.id, v_workout_id,
            round(200 * v_mult)::integer, 25, 'skill_unlock', v_today);
        else
          v_unlock := public.award_skill_unlock(
            v_user, v_node.id, v_workout_id,
            round(200 * 0.25 * v_mult)::integer, 6, 'skill_unlock_cascade', v_today);
        end if;
        if v_unlock is not null then
          v_unlocks := v_unlocks || v_unlock;
        end if;
      end loop;
    end if;
  end loop;

  v_equivalences := public.evaluate_milestones(v_user, v_before, v_workout_id, v_mult, v_today);

  return jsonb_build_object(
    'workout_id', v_workout_id,
    'activity', v_activity.slug,
    'activity_name', v_activity.name,
    'kind', v_kind,
    'minutes', p_duration_min,
    'distance_km', p_distance_km,
    'xp', v_awarded,
    'points', v_points,
    'capped', v_capped,
    'remaining_today', greatest(0, v_daily_cap - v_spent - v_awarded),
    'counted_for_streak', v_qualifies,
    'streak_len', v_len,
    'multiplier', v_mult,
    'milestones', v_milestones,
    'reset', v_reset,
    'unlocks', v_unlocks,
    'equivalences', v_equivalences
  );
end;
$$;

revoke execute on function public.log_activity(text, integer, numeric, text) from public, anon;
grant execute on function public.log_activity(text, integer, numeric, text) to authenticated;
