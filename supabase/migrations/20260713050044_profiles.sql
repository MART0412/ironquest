-- Slice 1: profiles table (spec §8) + RLS + auto-provision trigger.
-- One row per auth user, created automatically on signup and filled in by onboarding.

create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text,
  height_cm               numeric,
  weight_kg               numeric,               -- baseline for TDEE / protein target (Slice 1 addition to §8)
  dob                     date,
  sex                     text check (sex in ('male', 'female')),
  activity_factor         numeric,
  phase                   text not null default 'cut' check (phase in ('cut', 'maintain', 'build')),
  cal_target              integer,
  protein_g               integer,
  carbs_g                 integer,
  fat_g                   integer,
  split_config            jsonb,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.profiles is 'User profile, nutrition targets, and chosen training split. 1:1 with auth.users.';

-- Row Level Security: a user can only see and mutate their own profile row.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a bare profile row when a new auth user is created, so onboarding
-- only ever performs an UPDATE (never races an INSERT). Runs as definer to bypass RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
