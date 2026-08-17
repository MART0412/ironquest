-- Disciplines + multiclassing (Phase 3, slice 1).
--
-- Until now the schema assumed one way to train. This opens it to five, without
-- touching a single existing row's behaviour: exercises and skill paths gain a
-- discipline, every current row is backfilled to calisthenics, and everything
-- that reads the library scopes to what the user has activated.
--
-- Multiclassing is a reward, not a menu: your first discipline is a free choice,
-- a second requires level 15. The rule lives in activate_discipline (the sole
-- writer of user_disciplines) so a hand-crafted REST call can't walk around it.
-- Mirrors MULTICLASS_MIN_LEVEL in lib/game/disciplines.ts.

-- ---------------------------------------------------------------------------
-- 1. The five disciplines. Library data, so world-readable and never written
--    by a client — same shape as equivalence_milestones.
-- ---------------------------------------------------------------------------
create table public.disciplines (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  logging_style text not null
    check (logging_style in ('sets', 'endurance', 'session')),
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.disciplines is 'Ways of training. logging_style says how a session is recorded: sets x reps, an endurance effort (distance/time), or a whole-session check-off.';

alter table public.disciplines enable row level security;
create policy "Disciplines are readable by everyone"
  on public.disciplines for select using (true);

insert into public.disciplines (slug, name, logging_style, display_order) values
  ('calisthenics', 'Calisthenics', 'sets',      1),
  ('gym',          'Gym & Weights', 'sets',     2),
  ('running',      'Running',      'endurance', 3),
  ('cycling',      'Cycling',      'endurance', 4),
  ('yoga',         'Yoga & Mobility', 'session', 5);

-- ---------------------------------------------------------------------------
-- 2. Which disciplines a user trains. Owner-readable; written only by
--    activate_discipline, because activation is gated on level.
-- ---------------------------------------------------------------------------
create table public.user_disciplines (
  user_id       uuid not null references auth.users (id) on delete cascade,
  discipline_id uuid not null references public.disciplines (id) on delete restrict,
  is_primary    boolean not null default false,
  activated_at  timestamptz not null default now(),
  primary key (user_id, discipline_id)
);

-- Exactly one primary per user, enforced by the database rather than by care.
create unique index user_disciplines_one_primary
  on public.user_disciplines (user_id) where is_primary;

create index user_disciplines_user_idx on public.user_disciplines (user_id);

comment on table public.user_disciplines is 'Disciplines a user has activated. The first is their primary; a second requires the multiclass level. Written only by activate_discipline.';

alter table public.user_disciplines enable row level security;
create policy "User disciplines: owner select"
  on public.user_disciplines for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Generalise the library. Nullable → backfill → not null, so no row is ever
--    without a home. exercises.branch is untouched: it still groups movements
--    inside calisthenics, and rewriting it would change live data for no gain.
-- ---------------------------------------------------------------------------
alter table public.exercises
  add column discipline_id uuid references public.disciplines (id) on delete restrict;
alter table public.skill_paths
  add column discipline_id uuid references public.disciplines (id) on delete restrict;

update public.exercises
  set discipline_id = (select id from public.disciplines where slug = 'calisthenics')
  where discipline_id is null;
update public.skill_paths
  set discipline_id = (select id from public.disciplines where slug = 'calisthenics')
  where discipline_id is null;

alter table public.exercises  alter column discipline_id set not null;
alter table public.skill_paths alter column discipline_id set not null;

create index exercises_discipline_idx   on public.exercises (discipline_id);
create index skill_paths_discipline_idx on public.skill_paths (discipline_id);

comment on column public.exercises.discipline_id is 'Which discipline this movement belongs to. Everything seeded before Phase 3 is calisthenics.';

-- Everyone who already finished onboarding trains calisthenics — recorded as
-- data, not assumed by a code path that could be missed on some screen.
insert into public.user_disciplines (user_id, discipline_id, is_primary)
select p.id, d.id, true
from public.profiles p
cross join public.disciplines d
where d.slug = 'calisthenics'
  and p.onboarding_completed_at is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. The level curve, mirrored from lib/game/level.ts so the gate can read it.
-- ---------------------------------------------------------------------------
create or replace function public.xp_for_level(p_level integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_level <= 0 then 0
              else round(500 * power(p_level, 1.4))::integer end;
$$;

comment on function public.xp_for_level(integer) is 'Cumulative XP needed for a level. Mirrors xpForLevel in lib/game/level.ts.';

-- ---------------------------------------------------------------------------
-- 5. Activation — the only writer of user_disciplines.
--    First discipline: free, and marked primary.
--    Already active:   no-op, so a double tap is harmless.
--    Otherwise:        requires the multiclass level.
-- ---------------------------------------------------------------------------
create or replace function public.activate_discipline(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_min_lvl  constant integer := 15;  -- mirrors MULTICLASS_MIN_LEVEL
  v_id       uuid;
  v_has_any  boolean;
  v_total_xp integer;
  v_required integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select id into v_id from public.disciplines where slug = p_slug;
  if v_id is null then
    raise exception 'unknown_discipline';
  end if;

  if exists (
    select 1 from public.user_disciplines
    where user_id = v_user and discipline_id = v_id
  ) then
    return jsonb_build_object('activated', false, 'already', true, 'slug', p_slug);
  end if;

  select exists (
    select 1 from public.user_disciplines where user_id = v_user
  ) into v_has_any;

  if v_has_any then
    select coalesce(sum(xp), 0) into v_total_xp
    from public.xp_ledger where user_id = v_user;

    v_required := public.xp_for_level(v_min_lvl);

    if v_total_xp < v_required then
      raise exception 'multiclass_locked';
    end if;
  end if;

  insert into public.user_disciplines (user_id, discipline_id, is_primary)
  values (v_user, v_id, not v_has_any);

  return jsonb_build_object(
    'activated', true,
    'already', false,
    'slug', p_slug,
    'is_primary', not v_has_any);
end;
$$;

revoke execute on function public.activate_discipline(text) from public, anon;
grant execute on function public.activate_discipline(text) to authenticated;
