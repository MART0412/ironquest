-- Only nested ladders cascade (Phase 3, slice 3 follow-up).
--
-- Caught by the live E2E: logging a third run in a week cleared "Three in a
-- Week" and cascade-credited "Ten in a Month" — which the runner had plainly
-- not done. Distance and pace rungs contain each other (a marathon contains a
-- five, and 5:00/km contains 6:00/km), so crediting the rungs below the one you
-- reached is honest. A frequency window contains nothing: seven days says
-- nothing about thirty.
--
-- So log_activity now cascades only on nested ladders, and on a frequency
-- ladder pays full price for exactly the rungs actually met.

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
  v_nested        boolean;
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
    -- Do this ladder's rungs contain each other? Distance and pace do; a
    -- frequency window does not.
    select coalesce(bool_and(e.unlock_criteria->>'kind' in ('distance', 'pace')), false)
    into v_nested
    from public.skill_path_nodes spn
    join public.exercises e on e.id = spn.exercise_id
    where spn.path_id = v_path.path_id;

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
        select spn.position, e.id, e.unlock_criteria
        from public.skill_path_nodes spn
        join public.exercises e on e.id = spn.exercise_id
        where spn.path_id = v_path.path_id and spn.position <= v_deepest
        order by spn.position
      loop
        if v_node.position = v_deepest then
          -- The rung this session actually reached.
          v_unlock := public.award_skill_unlock(
            v_user, v_node.id, v_workout_id,
            round(200 * v_mult)::integer, 25, 'skill_unlock', v_today);
        elsif v_nested then
          -- Distance and pace nest: a marathon contains a five, so the rungs
          -- below the one you reached are genuinely implied. Credit them at
          -- the cascade rate, exactly like a calisthenics fast-track.
          v_unlock := public.award_skill_unlock(
            v_user, v_node.id, v_workout_id,
            round(200 * 0.25 * v_mult)::integer, 6, 'skill_unlock_cascade', v_today);
        elsif public.endurance_criteria_met(
          v_user, v_node.unlock_criteria, v_workout_id, v_today) then
          -- Frequency does NOT nest: three runs in a week says nothing about
          -- ten in a month. Only pay for rungs actually met, at full price,
          -- because each is its own achievement.
          v_unlock := public.award_skill_unlock(
            v_user, v_node.id, v_workout_id,
            round(200 * v_mult)::integer, 25, 'skill_unlock', v_today);
        else
          v_unlock := null;
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
