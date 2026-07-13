-- Slice 2: gamification domain (spec §8) — xp_ledger, streaks, rewards.
--
-- Hard rule 6: XP/points mutations go through a single server-side function.
-- Enforced here at the RLS layer: xp_ledger and streaks are SELECT-only for
-- clients (no insert/update/delete policies). The security-definer awarding
-- function is the Slice-4 XP engine; until then nothing can write these tables
-- except the postgres role itself.

-- ---------------------------------------------------------------------------
-- xp_ledger: append-only record of every XP/points award.
-- ref_id is intentionally FK-less (polymorphic: workout, meal day, checkin, …
-- depending on action). The Slice-4 engine defines the action vocabulary.
-- ---------------------------------------------------------------------------
create table public.xp_ledger (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ts      timestamptz not null default now(),
  action  text not null,
  xp      integer not null default 0,
  points  integer not null default 0,
  ref_id  uuid
);

create index xp_ledger_user_id_ts_idx on public.xp_ledger (user_id, ts desc);

comment on table public.xp_ledger is 'Append-only XP/points awards. Written only by the server-side XP engine (Slice 4); clients are read-only by RLS design.';

alter table public.xp_ledger enable row level security;

create policy "XP ledger: owner select"
  on public.xp_ledger for select
  using (user_id = auth.uid());
-- Deliberately no insert/update/delete policies (hard rule 6).

-- ---------------------------------------------------------------------------
-- streaks: one row per user, maintained by the streak engine (Slice 4).
-- ---------------------------------------------------------------------------
create table public.streaks (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  current_start date,
  current_len   integer not null default 0 check (current_len >= 0),
  best_len      integer not null default 0 check (best_len >= 0),
  updated_at    timestamptz not null default now()
);

comment on table public.streaks is 'Current/best streak per user. Written only by the server-side streak engine (Slice 4); clients are read-only by RLS design.';

alter table public.streaks enable row level security;

create policy "Streaks: owner select"
  on public.streaks for select
  using (user_id = auth.uid());
-- Deliberately no insert/update/delete policies (hard rule 6).

create trigger streaks_set_updated_at
  before update on public.streaks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- rewards: dual-economy points store (in-game + user-defined real-life).
-- ---------------------------------------------------------------------------
create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  cost_points integer not null check (cost_points > 0),
  type        text not null check (type in ('in_game', 'real_life')),
  redeemed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index rewards_user_id_idx on public.rewards (user_id);

alter table public.rewards enable row level security;

create policy "Rewards: owner select" on public.rewards for select using (user_id = auth.uid());
create policy "Rewards: owner insert" on public.rewards for insert with check (user_id = auth.uid());
create policy "Rewards: owner update" on public.rewards for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Rewards: owner delete" on public.rewards for delete using (user_id = auth.uid());

create trigger rewards_set_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Signup provisioning: redefine handle_new_user (from the Slice-1 migration —
-- never editing a pushed file) to also create the user's streaks row, and
-- backfill streaks for any users created before this migration.
-- ---------------------------------------------------------------------------
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

  insert into public.streaks (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.streaks (user_id)
select id from auth.users
on conflict (user_id) do nothing;
