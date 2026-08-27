-- The daily activity cap has to trim points too (Phase 3, slice 2 follow-up).
--
-- Browser verification caught this: a session capped from 103 XP down to 47
-- still paid the full 10 points, because points were computed from the
-- *proposal* rather than the award. The XP cap was doing its job and the points
-- were walking straight past it.
--
-- log_activity is recreated with points derived from what was actually paid,
-- de-multiplied so a streak still can't inflate them. Mirrors activityPoints in
-- lib/fitness/activities.ts.

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
