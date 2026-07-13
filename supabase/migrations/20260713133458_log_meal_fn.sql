-- Slice 6: meal logging engine + nutrition awards (spec §2.1) and a shared
-- streak evaluator so complete_workout and log_meal run ONE implementation of
-- the §2.2 rules instead of two drifting copies.
--
-- Rules mirrored from lib/game/streak.ts and lib/game/nutrition.ts (the
-- unit-tested specifications). Keep them in lockstep.

-- ---------------------------------------------------------------------------
-- 1. xp_ledger.ref_date — which MX calendar day an award is FOR. Daily awards
--    (protein_target / meals_logged / calorie_target) dedupe on (action, day).
-- ---------------------------------------------------------------------------
alter table public.xp_ledger add column ref_date date;

-- ---------------------------------------------------------------------------
-- 2. Shared streak evaluator (extracted from complete_workout, Slice 4).
--    Locks the caller's streaks row, gap-fills/extends/resets per §2.2 when
--    today qualifies, inserts milestone awards, returns the post-update state.
--    NOT client-callable: only the engine functions may invoke it.
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_streak_and_award(
  p_user           uuid,
  p_today          date,
  p_today_qualifies boolean,
  p_ref_id         uuid default null
)
returns table (streak_len integer, multiplier numeric, milestones integer, was_reset boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_streak    public.streaks%rowtype;
  v_last_day  date;
  v_gap_day   date;
  v_gap_ok    boolean := true;
  v_old_len   integer;
  v_new_len   integer;
  v_new_start date;
  v_reset     boolean := false;
  v_mult      numeric;
  v_count     integer := 0;
  m           integer;
begin
  select * into v_streak from public.streaks where user_id = p_user for update;
  if not found then
    insert into public.streaks (user_id) values (p_user) returning * into v_streak;
  end if;

  if not p_today_qualifies then
    -- Nothing to extend (e.g. meals on a scheduled training day): report the
    -- current state untouched.
    return query select
      v_streak.current_len,
      least(1.0 + 0.05 * floor(v_streak.current_len / 7.0), 1.5)::numeric,
      0, false;
    return;
  end if;

  if v_streak.current_len = 0 or v_streak.current_start is null then
    v_new_start := p_today; v_new_len := 1; v_old_len := 0;
  else
    v_last_day := v_streak.current_start + v_streak.current_len - 1;

    if p_today <= v_last_day then
      v_new_start := v_streak.current_start;
      v_new_len := v_streak.current_len;
      v_old_len := v_streak.current_len;
    elsif p_today = v_last_day + 1 then
      v_new_start := v_streak.current_start;
      v_new_len := v_streak.current_len + 1;
      v_old_len := v_streak.current_len;
    else
      -- Gap-fill: every skipped day must have been a valid streak day —
      -- a completed workout, or an unscheduled rest day with meals logged.
      v_gap_day := v_last_day + 1;
      while v_gap_day < p_today loop
        if not (
          exists (
            select 1 from public.workouts w
            where w.user_id = p_user and w.date = v_gap_day and w.status = 'completed'
          )
          or (
            not exists (
              select 1 from public.routines r
              where r.user_id = p_user and to_char(v_gap_day, 'dy') = any (r.day_of_week)
            )
            and exists (
              select 1 from public.meal_logs ml
              where ml.user_id = p_user
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
        v_new_len := v_streak.current_len + (p_today - v_last_day);
        v_old_len := v_streak.current_len;
      else
        -- Hardcore reset: only the streak dies; xp_ledger is never touched.
        v_new_start := p_today; v_new_len := 1; v_old_len := 0; v_reset := true;
      end if;
    end if;
  end if;

  update public.streaks
  set current_start = v_new_start,
      current_len   = v_new_len,
      best_len      = greatest(best_len, v_new_len)
  where user_id = p_user;

  v_mult := least(1.0 + 0.05 * floor(v_new_len / 7.0), 1.5);

  m := (floor(v_old_len / 7.0)::integer + 1) * 7;
  while m <= v_new_len loop
    insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
    values (p_user, 'streak_milestone', round(100 * v_mult)::integer, 20, p_ref_id, p_today);
    v_count := v_count + 1;
    m := m + 7;
  end loop;

  return query select v_new_len, v_mult, v_count, v_reset;
end;
$$;

revoke execute on function public.evaluate_streak_and_award(uuid, date, boolean, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. complete_workout — behavior-identical refactor: streak block delegated to
--    the shared evaluator. (New rows also stamp ref_date; the bonus-cap check
--    keeps its original ts-based form so pre-migration rows still count.)
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
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_today := (now() at time zone 'America/Mexico_City')::date;
  v_weekday := to_char(v_today, 'dy');

  -- Serialize the engine per user before any award checks (the evaluator
  -- re-takes the same lock, which is a no-op inside this transaction).
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

  -- A completed workout always qualifies today as a streak day (§2.2).
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

  return jsonb_build_object(
    'workout_id', v_workout_id,
    'action', v_action,
    'xp', v_xp,
    'points', v_points,
    'streak_len', v_len,
    'multiplier', v_mult,
    'milestones', v_milestones,
    'reset', v_reset
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. log_meal — the nutrition side of the engine (rule 6: the only writer of
--    nutrition XP). All params default so the one-tap re-log path can pass
--    just p_food_id; each path validates its own inputs.
-- ---------------------------------------------------------------------------
create or replace function public.log_meal(
  p_name    text default null,
  p_kcal    numeric default null,
  p_protein numeric default 0,
  p_carbs   numeric default 0,
  p_fat     numeric default 0,
  p_serving text default null,
  p_food_id uuid default null,   -- re-log an existing library food
  p_save    boolean default false -- save manual entry to My Foods
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user           uuid := auth.uid();
  v_today          date;
  v_food_id        uuid;
  v_name           text;
  v_kcal           numeric;
  v_protein        numeric;
  v_carbs          numeric;
  v_fat            numeric;
  v_serving        text;
  v_meal_id        uuid;
  v_day_kcal       numeric;
  v_day_protein    numeric;
  v_day_carbs      numeric;
  v_day_fat        numeric;
  v_day_count      integer;
  v_protein_target integer;
  v_cal_target     integer;
  v_is_rest        boolean;
  v_trained        boolean;
  v_len            integer;
  v_mult           numeric;
  v_milestones     integer;
  v_reset          boolean;
  v_awards         jsonb := '[]'::jsonb;
  v_award_xp       integer;
  v_sweep_day      date;
  v_sweep_kcal     numeric;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_today := (now() at time zone 'America/Mexico_City')::date;

  -- Serialize per user before any dedup checks.
  perform 1 from public.streaks where user_id = v_user for update;

  -- Resolve the food being logged.
  if p_food_id is not null then
    select id, name, kcal, protein_g, carbs_g, fat_g, serving
    into v_food_id, v_name, v_kcal, v_protein, v_carbs, v_fat, v_serving
    from public.foods
    where id = p_food_id and (user_id is null or user_id = v_user);

    if not found then
      raise exception 'food not found';
    end if;
  else
    -- Manual entry: definer functions validate their own inputs.
    v_name := trim(coalesce(p_name, ''));
    if length(v_name) < 1 or length(v_name) > 80 then
      raise exception 'invalid name';
    end if;
    if p_kcal is null or p_kcal < 0 or p_kcal > 3000 then
      raise exception 'invalid kcal';
    end if;

    v_kcal := p_kcal;
    v_protein := coalesce(p_protein, 0);
    v_carbs := coalesce(p_carbs, 0);
    v_fat := coalesce(p_fat, 0);
    v_serving := p_serving;

    if least(v_protein, v_carbs, v_fat) < 0 or greatest(v_protein, v_carbs, v_fat) > 300 then
      raise exception 'invalid macros';
    end if;
    if v_serving is not null and length(v_serving) > 40 then
      raise exception 'invalid serving';
    end if;

    -- Every entry gets a foods row (meal_logs has no name column). Saved
    -- entries go to My Foods ('custom', reusing a same-named food); unsaved
    -- ones stay 'adhoc' — named for the timeline, hidden from the library.
    if p_save then
      select id into v_food_id
      from public.foods
      where user_id = v_user and source = 'custom' and lower(name) = lower(v_name);

      if found then
        update public.foods
        set kcal = v_kcal, protein_g = v_protein, carbs_g = v_carbs,
            fat_g = v_fat, serving = v_serving
        where id = v_food_id;
      else
        insert into public.foods (user_id, name, kcal, protein_g, carbs_g, fat_g, serving, source)
        values (v_user, v_name, v_kcal, v_protein, v_carbs, v_fat, v_serving, 'custom')
        returning id into v_food_id;
      end if;
    else
      insert into public.foods (user_id, name, kcal, protein_g, carbs_g, fat_g, serving, source)
      values (v_user, v_name, v_kcal, v_protein, v_carbs, v_fat, v_serving, 'adhoc')
      returning id into v_food_id;
    end if;
  end if;

  insert into public.meal_logs (user_id, food_id, kcal, protein_g, carbs_g, fat_g)
  values (v_user, v_food_id, v_kcal, v_protein, v_carbs, v_fat)
  returning id into v_meal_id;

  -- Today's totals (MX day), including the row just inserted.
  select coalesce(sum(kcal), 0), coalesce(sum(protein_g), 0),
         coalesce(sum(carbs_g), 0), coalesce(sum(fat_g), 0), count(*)
  into v_day_kcal, v_day_protein, v_day_carbs, v_day_fat, v_day_count
  from public.meal_logs
  where user_id = v_user
    and (ts at time zone 'America/Mexico_City')::date = v_today;

  select protein_g, cal_target into v_protein_target, v_cal_target
  from public.profiles where id = v_user;

  -- Streak: on an unscheduled rest day, meals make today count (§2.2). A
  -- completed workout today also qualifies regardless of schedule.
  v_is_rest := not exists (
    select 1 from public.routines r
    where r.user_id = v_user and to_char(v_today, 'dy') = any (r.day_of_week)
  );
  v_trained := exists (
    select 1 from public.workouts w
    where w.user_id = v_user and w.date = v_today and w.status = 'completed'
  );

  select * into v_len, v_mult, v_milestones, v_reset
  from public.evaluate_streak_and_award(v_user, v_today, v_is_rest or v_trained, v_meal_id);

  -- Immediate awards (mirrors lib/game/nutrition.ts) — one per action per day.
  if v_protein_target is not null and v_protein_target > 0
     and v_day_protein >= v_protein_target
     and not exists (
       select 1 from public.xp_ledger
       where user_id = v_user and action = 'protein_target' and ref_date = v_today
     ) then
    v_award_xp := round(40 * v_mult)::integer;
    insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
    values (v_user, 'protein_target', v_award_xp, 4, v_meal_id, v_today);
    v_awards := v_awards || jsonb_build_object('action', 'protein_target', 'xp', v_award_xp, 'points', 4);
  end if;

  if v_day_count >= 3
     and not exists (
       select 1 from public.xp_ledger
       where user_id = v_user and action = 'meals_logged' and ref_date = v_today
     ) then
    v_award_xp := round(20 * v_mult)::integer;
    insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
    values (v_user, 'meals_logged', v_award_xp, 2, v_meal_id, v_today);
    v_awards := v_awards || jsonb_build_object('action', 'meals_logged', 'xp', v_award_xp, 'points', 2);
  end if;

  -- Calorie band (±5%) is an end-of-day condition: sweep the last 7 completed
  -- days and award any qualifying day not yet awarded.
  if v_cal_target is not null and v_cal_target > 0 then
    v_sweep_day := v_today - 7;
    while v_sweep_day < v_today loop
      if not exists (
           select 1 from public.xp_ledger
           where user_id = v_user and action = 'calorie_target' and ref_date = v_sweep_day
         ) then
        select sum(kcal) into v_sweep_kcal
        from public.meal_logs
        where user_id = v_user
          and (ts at time zone 'America/Mexico_City')::date = v_sweep_day;

        if v_sweep_kcal is not null
           and abs(v_sweep_kcal - v_cal_target) <= 0.05 * v_cal_target then
          v_award_xp := round(40 * v_mult)::integer;
          insert into public.xp_ledger (user_id, action, xp, points, ref_date)
          values (v_user, 'calorie_target', v_award_xp, 4, v_sweep_day);
          v_awards := v_awards || jsonb_build_object(
            'action', 'calorie_target', 'xp', v_award_xp, 'points', 4, 'for_day', v_sweep_day
          );
        end if;
      end if;
      v_sweep_day := v_sweep_day + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'meal_log_id', v_meal_id,
    'awards', v_awards,
    'streak_len', v_len,
    'multiplier', v_mult,
    'milestones', v_milestones,
    'day', jsonb_build_object(
      'kcal', v_day_kcal, 'protein', v_day_protein,
      'carbs', v_day_carbs, 'fat', v_day_fat, 'count', v_day_count
    )
  );
end;
$$;

revoke execute on function public.log_meal(text, numeric, numeric, numeric, numeric, text, uuid, boolean)
  from public, anon;
grant execute on function public.log_meal(text, numeric, numeric, numeric, numeric, text, uuid, boolean)
  to authenticated;
