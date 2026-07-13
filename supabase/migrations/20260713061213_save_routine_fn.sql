-- Slice 3: atomic routine save. Creating/updating a routine replaces its items
-- (delete + bulk insert); doing that as separate PostgREST calls could empty a
-- routine if a request fails mid-flight, so the whole operation is one function.
--
-- SECURITY INVOKER on purpose: RLS still governs every row this touches, so a
-- caller can only ever create/modify their own routines and items. (This is a
-- user-data mutation, not an XP/points mutation — hard rule 6 does not apply.)

create or replace function public.save_routine(
  p_name        text,
  p_day_of_week text[],
  p_items       jsonb,             -- [{exercise_id, sets, reps_or_seconds, is_hold}]
  p_id          uuid default null  -- omit/null to create, existing id to update
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.routines (user_id, name, day_of_week)
    values (auth.uid(), p_name, p_day_of_week)
    returning id into v_id;
  else
    update public.routines
    set name = p_name, day_of_week = p_day_of_week
    where id = p_id
    returning id into v_id;

    -- RLS filters other users' rows, so a foreign/unknown id updates nothing.
    if v_id is null then
      raise exception 'routine not found';
    end if;
  end if;

  delete from public.routine_items where routine_id = v_id;

  insert into public.routine_items
    (routine_id, exercise_id, sets, reps_or_seconds, is_hold, sort_order)
  select
    v_id,
    (item->>'exercise_id')::uuid,
    (item->>'sets')::integer,
    (item->>'reps_or_seconds')::integer,
    coalesce((item->>'is_hold')::boolean, false),
    ord::integer
  from jsonb_array_elements(p_items) with ordinality as t(item, ord);

  return v_id;
end;
$$;
