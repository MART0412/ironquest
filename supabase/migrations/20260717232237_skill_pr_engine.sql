-- Slice 7 (Phase 2 start): skill-unlock engine + PR detection, added to the
-- security-definer complete_workout (CLAUDE.md rule 6 — the sole writer of XP).
--
-- Rules mirror lib/game/skills.ts (the unit-tested specification): criteria
-- evaluation, prerequisite gating + same-pass cascade, PR = strictly-greater
-- vs an existing baseline. Keep both in lockstep.
--
-- create or replace preserves the existing grants (authenticated) from Slice 4.
-- DEFINER bypasses RLS, so every query is manually scoped by v_user; the added
-- workout_sets history query joins workouts (which carries user_id).

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
  v_ex                record;
  v_met               boolean;
  v_award_xp          integer;
  v_pr                record;
  v_hist_reps         integer;
  v_hist_seconds      integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  v_today := (now() at time zone 'America/Mexico_City')::date;
  v_weekday := to_char(v_today, 'dy');

  -- Serialize the engine per user before any award checks.
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

  -- Workout award (scheduled / bonus / capped).
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

  -- -------------------------------------------------------------------------
  -- Personal records (spec §2.1: 75/10, "auto-detected from logs").
  -- Per exercise trained this workout: this workout's best reps/seconds vs the
  -- user's best from PRIOR workouts. Strictly greater, against an existing
  -- baseline only (first log sets the baseline). Reps metric wins ties in kind.
  -- Fires regardless of the workout award (a capped 3rd session can still PR).
  -- -------------------------------------------------------------------------
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
        'metric', 'reps', 'value', v_pr.best_reps, 'xp', v_award_xp
      );
    elsif v_pr.best_seconds is not null and v_hist_seconds is not null
       and v_pr.best_seconds > v_hist_seconds then
      v_award_xp := round(75 * v_mult)::integer;
      insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
      values (v_user, 'personal_record', v_award_xp, 10, v_pr.exercise_id, v_today);
      v_prs := v_prs || jsonb_build_object(
        'exercise_id', v_pr.exercise_id, 'slug', v_pr.slug, 'name', v_pr.name,
        'metric', 'seconds', 'value', v_pr.best_seconds, 'xp', v_award_xp
      );
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- Skill unlocks (spec §2.1: 200/25; §3.1 tree). Evaluate exercises trained
  -- this workout in ascending (branch, tier): a prerequisite unlocked earlier
  -- in this same pass enables its successor. A node needs its tier-1-lower
  -- same-branch predecessor unlocked (tier 1 has none), its criteria met by
  -- this workout's sets, and to not already be unlocked.
  -- -------------------------------------------------------------------------
  for v_ex in
    select e.id, e.slug, e.name, e.branch, e.tier, e.unlock_criteria
    from public.exercises e
    where e.unlock_criteria is not null
      and e.id in (select exercise_id from public.workout_sets where workout_id = v_workout_id)
    order by e.branch, e.tier
  loop
    -- already unlocked?
    if exists (
      select 1 from public.skill_unlocks
      where user_id = v_user and exercise_id = v_ex.id
    ) then
      continue;
    end if;

    -- prerequisite (same branch, one tier lower) must be unlocked, unless tier 1
    if v_ex.tier > 1 and not exists (
      select 1
      from public.skill_unlocks su
      join public.exercises pe on pe.id = su.exercise_id
      where su.user_id = v_user
        and pe.branch = v_ex.branch
        and pe.tier = v_ex.tier - 1
    ) then
      continue;
    end if;

    -- criteria met by this workout's sets?
    if v_ex.unlock_criteria->>'kind' = 'reps' then
      select count(*) >= (v_ex.unlock_criteria->>'sets')::integer
      into v_met
      from public.workout_sets
      where workout_id = v_workout_id and exercise_id = v_ex.id
        and reps >= (v_ex.unlock_criteria->>'reps')::integer;
    elsif v_ex.unlock_criteria->>'kind' = 'hold' then
      select count(*) >= (v_ex.unlock_criteria->>'sets')::integer
      into v_met
      from public.workout_sets
      where workout_id = v_workout_id and exercise_id = v_ex.id
        and seconds >= (v_ex.unlock_criteria->>'seconds')::integer;
    else
      v_met := false;
    end if;

    if v_met then
      insert into public.skill_unlocks (user_id, exercise_id, evidence_workout_id)
      values (v_user, v_ex.id, v_workout_id)
      on conflict (user_id, exercise_id) do nothing;

      v_award_xp := round(200 * v_mult)::integer;
      insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
      values (v_user, 'skill_unlock', v_award_xp, 25, v_ex.id, v_today);

      v_unlocks := v_unlocks || jsonb_build_object(
        'exercise_id', v_ex.id, 'slug', v_ex.slug, 'name', v_ex.name,
        'branch', v_ex.branch, 'tier', v_ex.tier, 'xp', v_award_xp
      );
    end if;
  end loop;

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
    'prs', v_prs
  );
end;
$$;
