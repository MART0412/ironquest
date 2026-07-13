-- Slice 2: nutrition domain (spec §8) — foods, meal_logs, checkins.
-- Naming deviation from §8 shorthand: p/c/f → protein_g/carbs_g/fat_g and
-- measurement columns get _cm suffixes, matching profiles' unit-explicit style.

-- ---------------------------------------------------------------------------
-- foods: global/seeded entries (user_id null) + per-user My Foods library.
-- ---------------------------------------------------------------------------
create table public.foods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  name       text not null,
  kcal       numeric not null check (kcal >= 0),
  protein_g  numeric not null default 0 check (protein_g >= 0),
  carbs_g    numeric not null default 0 check (carbs_g >= 0),
  fat_g      numeric not null default 0 check (fat_g >= 0),
  serving    text,
  source     text,                            -- e.g. 'custom' | 'ai' | 'openfoodfacts' | 'seed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index foods_user_id_idx on public.foods (user_id) where user_id is not null;

alter table public.foods enable row level security;

create policy "Foods: library and own foods are viewable"
  on public.foods for select
  using (user_id is null or user_id = auth.uid());

create policy "Foods: owner insert" on public.foods for insert with check (user_id = auth.uid());
create policy "Foods: owner update" on public.foods for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Foods: owner delete" on public.foods for delete using (user_id = auth.uid());

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meal_logs: one logged eating event. Macros denormalized so edits to a food
-- never rewrite history. comp_* columns are Phase-3 (compensation feature),
-- created now per full-schema slice.
-- ---------------------------------------------------------------------------
create table public.meal_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  ts                timestamptz not null default now(),
  food_id           uuid references public.foods (id) on delete set null,
  ai_raw            jsonb,
  kcal              numeric not null check (kcal >= 0),
  protein_g         numeric not null default 0 check (protein_g >= 0),
  carbs_g           numeric not null default 0 check (carbs_g >= 0),
  fat_g             numeric not null default 0 check (fat_g >= 0),
  indulgence        boolean not null default false,
  comp_mode         text not null default 'neutral' check (comp_mode in ('neutral', 'strict')),
  comp_quest_status text check (comp_quest_status in ('offered', 'completed', 'ignored')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index meal_logs_user_id_ts_idx on public.meal_logs (user_id, ts desc);

alter table public.meal_logs enable row level security;

create policy "Meal logs: owner select" on public.meal_logs for select using (user_id = auth.uid());
create policy "Meal logs: owner insert" on public.meal_logs for insert with check (user_id = auth.uid());
create policy "Meal logs: owner update" on public.meal_logs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Meal logs: owner delete" on public.meal_logs for delete using (user_id = auth.uid());

create trigger meal_logs_set_updated_at
  before update on public.meal_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- checkins: the weekly ritual (spec §6). One per calendar day max.
-- date = calendar day in America/Mexico_City, computed app-side.
-- ---------------------------------------------------------------------------
create table public.checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  weight_kg   numeric check (weight_kg > 0),
  waist_cm    numeric check (waist_cm > 0),
  neck_cm     numeric check (neck_cm > 0),
  chest_cm    numeric check (chest_cm > 0),
  arm_cm      numeric check (arm_cm > 0),
  thigh_cm    numeric check (thigh_cm > 0),
  bf_estimate numeric check (bf_estimate > 0 and bf_estimate < 100),
  photo_paths text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.checkins enable row level security;

create policy "Checkins: owner select" on public.checkins for select using (user_id = auth.uid());
create policy "Checkins: owner insert" on public.checkins for insert with check (user_id = auth.uid());
create policy "Checkins: owner update" on public.checkins for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Checkins: owner delete" on public.checkins for delete using (user_id = auth.uid());

create trigger checkins_set_updated_at
  before update on public.checkins
  for each row execute function public.set_updated_at();
