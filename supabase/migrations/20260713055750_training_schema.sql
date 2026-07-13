-- Slice 2: training domain (spec §8) — exercises, routines, routine_items,
-- workouts, workout_sets, skill_unlocks. RLS on every table at creation.

-- ---------------------------------------------------------------------------
-- exercises: the skill-tree node library. Global seeded rows have user_id null;
-- user-created customs have user_id set and is_custom true.
-- ---------------------------------------------------------------------------
create table public.exercises (
  id              uuid primary key default gen_random_uuid(),
  slug            text,                       -- stable key for seeded nodes (null for customs)
  name            text not null,
  branch          text not null check (branch in ('push', 'pull', 'core', 'legs', 'static')),
  tier            integer not null check (tier > 0),
  unlock_criteria jsonb,
  demo_notes      text,                       -- spec §3.1: each node has demo notes
  is_custom       boolean not null default false,
  user_id         uuid references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint exercises_custom_owner check (is_custom = (user_id is not null))
);

create unique index exercises_slug_key on public.exercises (slug) where slug is not null;
create index exercises_branch_tier_idx on public.exercises (branch, tier);
create index exercises_user_id_idx on public.exercises (user_id) where user_id is not null;

comment on table public.exercises is 'Calisthenics skill-tree nodes: global seeded library (user_id null) + per-user customs.';

alter table public.exercises enable row level security;

create policy "Exercises: library and own customs are viewable"
  on public.exercises for select
  using (user_id is null or user_id = auth.uid());

create policy "Exercises: users insert own customs"
  on public.exercises for insert
  with check (user_id = auth.uid() and is_custom);

create policy "Exercises: users update own customs"
  on public.exercises for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_custom);

create policy "Exercises: users delete own customs"
  on public.exercises for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- routines: a named workout assigned to weekdays (defines the split).
-- ---------------------------------------------------------------------------
create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  day_of_week text[] not null default '{}',  -- {mon,tue,...}; validated app-side
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index routines_user_id_idx on public.routines (user_id);

alter table public.routines enable row level security;

create policy "Routines: owner select" on public.routines for select using (user_id = auth.uid());
create policy "Routines: owner insert" on public.routines for insert with check (user_id = auth.uid());
create policy "Routines: owner update" on public.routines for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Routines: owner delete" on public.routines for delete using (user_id = auth.uid());

create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- routine_items: prescribed exercises within a routine.
-- Deviations from §8 shorthand: surrogate id (same exercise may appear twice),
-- "order" renamed sort_order (reserved word), is_hold disambiguates reps vs seconds.
-- ---------------------------------------------------------------------------
create table public.routine_items (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references public.routines (id) on delete cascade,
  exercise_id     uuid not null references public.exercises (id) on delete restrict,
  sets            integer not null check (sets > 0),
  reps_or_seconds integer not null check (reps_or_seconds > 0),
  is_hold         boolean not null default false,
  sort_order      integer not null,
  unique (routine_id, sort_order)
);

create index routine_items_routine_id_idx on public.routine_items (routine_id);

alter table public.routine_items enable row level security;

create policy "Routine items: owner select"
  on public.routine_items for select
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));

create policy "Routine items: owner insert"
  on public.routine_items for insert
  with check (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));

create policy "Routine items: owner update"
  on public.routine_items for update
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));

create policy "Routine items: owner delete"
  on public.routine_items for delete
  using (exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- workouts: one logged (or planned) session. date = calendar day in
-- America/Mexico_City, computed app-side.
-- ---------------------------------------------------------------------------
create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  routine_id uuid references public.routines (id) on delete set null,
  status     text not null default 'completed' check (status in ('planned', 'completed', 'skipped')),
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_user_id_date_idx on public.workouts (user_id, date desc);

alter table public.workouts enable row level security;

create policy "Workouts: owner select" on public.workouts for select using (user_id = auth.uid());
create policy "Workouts: owner insert" on public.workouts for insert with check (user_id = auth.uid());
create policy "Workouts: owner update" on public.workouts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Workouts: owner delete" on public.workouts for delete using (user_id = auth.uid());

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workout_sets: per-set detail. Composite PK per §8 (workout, exercise, set_no).
-- ---------------------------------------------------------------------------
create table public.workout_sets (
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_no      integer not null check (set_no > 0),
  reps        integer check (reps > 0),
  seconds     integer check (seconds > 0),
  rpe         numeric check (rpe >= 1 and rpe <= 10),
  primary key (workout_id, exercise_id, set_no)
);

alter table public.workout_sets enable row level security;

create policy "Workout sets: owner select"
  on public.workout_sets for select
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create policy "Workout sets: owner insert"
  on public.workout_sets for insert
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create policy "Workout sets: owner update"
  on public.workout_sets for update
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create policy "Workout sets: owner delete"
  on public.workout_sets for delete
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- skill_unlocks: which tree nodes a user has lit up.
-- ---------------------------------------------------------------------------
create table public.skill_unlocks (
  user_id             uuid not null references auth.users (id) on delete cascade,
  exercise_id         uuid not null references public.exercises (id) on delete cascade,
  unlocked_at         timestamptz not null default now(),
  evidence_workout_id uuid references public.workouts (id) on delete set null,
  primary key (user_id, exercise_id)
);

create index skill_unlocks_user_id_idx on public.skill_unlocks (user_id);

alter table public.skill_unlocks enable row level security;

create policy "Skill unlocks: owner select" on public.skill_unlocks for select using (user_id = auth.uid());
create policy "Skill unlocks: owner insert" on public.skill_unlocks for insert with check (user_id = auth.uid());
create policy "Skill unlocks: owner delete" on public.skill_unlocks for delete using (user_id = auth.uid());
