-- Session 12: switch the unlock engine's prerequisite adjacency from
-- branch/tier to skill-path position. Everything else in complete_workout is
-- unchanged — XP/points values, streak evaluation, PR detection, the bonus cap
-- and the award rows all behave exactly as before.
--
-- New rule: a node is unlockable when ANY path containing it has either
--   (a) that node at position 1, or
--   (b) its immediate predecessor (position - 1) already unlocked.
-- "Any path grants access" is the natural rule for shared nodes (e.g. dead hang
-- opens four paths at once), and an unlock stays per-exercise, so unlocking a
-- shared node lights it in every path that contains it.
--
-- Candidates are evaluated in ascending min(position) order so a predecessor
-- unlocked earlier in this same workout enables its successor in the same pass.

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

  -- Workout award (scheduled / bonus / capped) — unchanged.
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
  -- Personal records (spec §2.1) — unchanged.
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
  -- Skill unlocks — PATH-based adjacency (the change in this migration).
  -- Ordered by the node's earliest position across its paths so a predecessor
  -- unlocked in this same pass enables its successor.
  -- -------------------------------------------------------------------------
  for v_ex in
    select e.id, e.slug, e.name, e.branch, e.tier, e.unlock_criteria,
           min(n.position) as first_position
    from public.exercises e
    join public.skill_path_nodes n on n.exercise_id = e.id
    where e.unlock_criteria is not null
      and e.id in (select exercise_id from public.workout_sets where workout_id = v_workout_id)
    group by e.id, e.slug, e.name, e.branch, e.tier, e.unlock_criteria
    order by min(n.position), e.slug
  loop
    -- already unlocked?
    if exists (
      select 1 from public.skill_unlocks
      where user_id = v_user and exercise_id = v_ex.id
    ) then
      continue;
    end if;

    -- Prerequisite: any containing path where this is first, or where its
    -- immediate predecessor in that path is already unlocked.
    if not exists (
      select 1
      from public.skill_path_nodes n
      where n.exercise_id = v_ex.id
        and (
          n.position = 1
          or exists (
            select 1
            from public.skill_path_nodes prev
            join public.skill_unlocks su
              on su.exercise_id = prev.exercise_id and su.user_id = v_user
            where prev.path_id = n.path_id
              and prev.position = n.position - 1
          )
        )
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
