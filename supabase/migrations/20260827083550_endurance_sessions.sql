-- Endurance logging + quick bonus activities (Phase 3, slice 2).
--
-- complete_workout speaks sets x reps, which is the wrong shape for a 5 km run.
-- Rather than a parallel session table, `workouts` grows a `kind`: a run simply
-- IS a completed workout row, so the streak gap-fill, the lifetime session
-- counter and "done today" all keep working without learning a second shape.
--
-- MET values mirror lib/fitness/activities.ts, which stays the source of truth
-- (the live check asserts they agree). They live here too because rule 6 puts
-- the XP decision in SQL, and SQL needs the intensity to make it.

-- ---------------------------------------------------------------------------
-- 1. Sessions that are measured in minutes, not reps.
--    The default on `kind` is what leaves every existing row untouched.
-- ---------------------------------------------------------------------------
alter table public.workouts
  add column kind text not null default 'sets'
    check (kind in ('sets', 'endurance', 'activity')),
  add column activity_slug text,
  add column duration_min integer check (duration_min is null or duration_min > 0),
  add column distance_km numeric(6, 2) check (distance_km is null or distance_km >= 0),
  add column notes text;

-- A duration-based session must say what it was and how long it lasted; a
-- set-based one must not pretend to have either.
alter table public.workouts
  add constraint workouts_kind_shape check (
    (kind = 'sets' and activity_slug is null and duration_min is null)
    or (kind in ('endurance', 'activity') and activity_slug is not null and duration_min is not null)
  );

comment on column public.workouts.kind is 'sets = reps/holds via complete_workout; endurance = a discipline session (run, ride); activity = a quick bonus activity. All three are real completed sessions for streak purposes.';

create index workouts_user_kind_idx on public.workouts (user_id, kind);

-- ---------------------------------------------------------------------------
-- 2. The activity catalog. Library data: world-readable, never client-written.
-- ---------------------------------------------------------------------------
create table public.activities (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  met           numeric(4, 1) not null check (met > 0),
  kind          text not null check (kind in ('endurance', 'bonus')),
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.activities is 'Mirror of ACTIVITIES in lib/fitness/activities.ts. The TS config is the source of truth; these rows exist so log_activity can price a session server-side.';

alter table public.activities enable row level security;
create policy "Activities are readable by everyone"
  on public.activities for select using (true);

insert into public.activities (slug, name, met, kind, display_order) values
  ('run', 'Run', 9.8, 'endurance', 1),
  ('jog', 'Jog', 7, 'bonus', 2),
  ('cycling-moderate', 'Cycling (moderate)', 8, 'endurance', 3),
  ('cycling-vigorous', 'Cycling (vigorous)', 10, 'endurance', 4),
  ('walk-brisk', 'Brisk walk', 4.3, 'bonus', 5),
  ('jump-rope', 'Jump rope', 12, 'bonus', 6),
  ('rowing', 'Rowing', 8.5, 'bonus', 7),
  ('swimming', 'Swimming', 8.3, 'bonus', 8),
  ('stair-climbing', 'Stair climbing', 8.8, 'bonus', 9),
  ('hiking', 'Hiking', 6, 'bonus', 10);

-- ---------------------------------------------------------------------------
-- 3. log_activity - the sole writer of duration-based sessions.
--    XP is duration x intensity, trimmed to what is left of today's cap, and
--    a long enough session counts as a streak day on the same rules as a
--    workout. Mirrors ACTIVITY_XP in lib/fitness/activities.ts.
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
  -- Points come off the UNMULTIPLIED award, so a streak can't inflate them.
  v_points := case
    when v_awarded = 0 then 0
    else round(round(v_activity.met * p_duration_min * v_xp_per_metmin)::numeric / 10)::integer
  end;

  if v_awarded > 0 then
    insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
    values (v_user, 'activity_session', v_awarded, v_points, v_workout_id, v_today);
    update public.workouts set xp_awarded = v_awarded where id = v_workout_id;
  end if;

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
    'equivalences', v_equivalences
  );
end;
$$;

revoke execute on function public.log_activity(text, integer, numeric, text) from public, anon;
grant execute on function public.log_activity(text, integer, numeric, text) to authenticated;
