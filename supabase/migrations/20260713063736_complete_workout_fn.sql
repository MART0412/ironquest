-- Slice 4: the XP/points/streak engine (CLAUDE.md hard rule 6 — the single
-- server-side entry point for every XP/points mutation).
--
-- SECURITY DEFINER because xp_ledger and streaks deliberately have no client
-- write policies (Slice 2). Because any authenticated user can call this via
-- REST, it accepts NO privileged inputs: every decision (scheduled vs bonus,
-- caps, streak math, multiplier, milestones) is computed here from the
-- caller's own data.
--
-- The rules mirror lib/game/streak.ts (the unit-tested specification of this
-- logic). Keep both in lockstep — every rule change lands in both places.

create or replace function public.complete_workout(
  p_routine_id uuid default null,   -- null = ad-hoc workout (Mode B, later slice)
  p_sets jsonb default '[]'         -- [{exercise_id, set_no, reps?, seconds?, rpe?}]
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
  v_streak            public.streaks%rowtype;
  v_last_day          date;
  v_gap_day           date;
  v_gap_ok            boolean := true;
  v_old_len           integer;  -- milestone-crossing baseline (0 after fresh/reset)
  v_new_len           integer;
  v_new_start         date;
  v_reset             boolean := false;
  v_is_scheduled      boolean := false;
  v_already_completed boolean := false;
  v_bonus_used        boolean;
  v_action            text;
  v_base_xp           integer := 0;
  v_points            integer := 0;
  v_mult              numeric;
  v_xp                integer := 0;
  v_milestones        integer := 0;
  m                   integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- All app "days" are calendar dates in Mexico City (CLAUDE.md conventions).
  v_today := (now() at time zone 'America/Mexico_City')::date;
  v_weekday := to_char(v_today, 'dy');  -- 'mon'..'sun', matches day_of_week values

  -- Serialize the whole engine per user: bonus cap and milestone crossing
  -- must not race concurrent completions.
  select * into v_streak from public.streaks where user_id = v_user for update;
  if not found then
    insert into public.streaks (user_id) values (v_user) returning * into v_streak;
  end if;

  -- Award classification (checked BEFORE inserting today's workout).
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

  -- Log the workout and its sets.
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

  -- ---------------------------------------------------------------------
  -- Streak update (mirrors evaluateStreak in lib/game/streak.ts).
  -- ---------------------------------------------------------------------
  if v_streak.current_len = 0 or v_streak.current_start is null then
    v_new_start := v_today;
    v_new_len := 1;
    v_old_len := 0;
  else
    v_last_day := v_streak.current_start + v_streak.current_len - 1;

    if v_today <= v_last_day then
      -- Already counted today (or clock weirdness): no change.
      v_new_start := v_streak.current_start;
      v_new_len := v_streak.current_len;
      v_old_len := v_streak.current_len;
    elsif v_today = v_last_day + 1 then
      v_new_start := v_streak.current_start;
      v_new_len := v_streak.current_len + 1;
      v_old_len := v_streak.current_len;
    else
      -- Gap-fill: every skipped day must have been a valid streak day —
      -- a completed workout, or an unscheduled rest day with meals logged.
      v_gap_day := v_last_day + 1;
      while v_gap_day < v_today loop
        if not (
          exists (
            select 1 from public.workouts w
            where w.user_id = v_user and w.date = v_gap_day and w.status = 'completed'
          )
          or (
            not exists (
              select 1 from public.routines r
              where r.user_id = v_user and to_char(v_gap_day, 'dy') = any (r.day_of_week)
            )
            and exists (
              select 1 from public.meal_logs ml
              where ml.user_id = v_user
                and (ml.ts at time zone 'America/Mexico_City')::date = v_gap_day
            )
          )
        ) then
          v_gap_ok := false;
          exit;
        end if;
        v_gap_day := v_gap_day + 1;
      end loop;

      if v_gap_ok then
        v_new_start := v_streak.current_start;
        v_new_len := v_streak.current_len + (v_today - v_last_day);
        v_old_len := v_streak.current_len;
      else
        -- Hardcore reset: only the streak dies. Nothing in xp_ledger is
        -- deleted or negated; best_len survives via greatest() below.
        v_new_start := v_today;
        v_new_len := 1;
        v_old_len := 0;
        v_reset := true;
      end if;
    end if;
  end if;

  update public.streaks
  set current_start = v_new_start,
      current_len   = v_new_len,
      best_len      = greatest(best_len, v_new_len)
  where user_id = v_user;

  -- Multiplier from the length AFTER today's update; applies to all XP.
  v_mult := least(1.0 + 0.05 * floor(v_new_len / 7.0), 1.5);

  -- Milestones: every multiple of 7 crossed by this update.
  m := (floor(v_old_len / 7.0)::integer + 1) * 7;
  while m <= v_new_len loop
    insert into public.xp_ledger (user_id, action, xp, points, ref_id)
    values (v_user, 'streak_milestone', round(100 * v_mult)::integer, 20, v_workout_id);
    v_milestones := v_milestones + 1;
    m := m + 7;
  end loop;

  -- Workout award (mirrors workoutAward in lib/game/streak.ts).
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
      v_action := 'capped';  -- workout logs fine; no award beyond the daily bonus
    end if;
  end if;

  if v_base_xp > 0 then
    v_xp := round(v_base_xp * v_mult)::integer;
    insert into public.xp_ledger (user_id, action, xp, points, ref_id)
    values (v_user, v_action, v_xp, v_points, v_workout_id);
    update public.workouts set xp_awarded = v_xp where id = v_workout_id;
  end if;

  return jsonb_build_object(
    'workout_id', v_workout_id,
    'action', v_action,
    'xp', v_xp,
    'points', v_points,
    'streak_len', v_new_len,
    'multiplier', v_mult,
    'milestones', v_milestones,
    'reset', v_reset
  );
end;
$$;

-- Definer function: callable only by signed-in users, never anon.
revoke execute on function public.complete_workout(uuid, jsonb) from public, anon;
grant execute on function public.complete_workout(uuid, jsonb) to authenticated;
