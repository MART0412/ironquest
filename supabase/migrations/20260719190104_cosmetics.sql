-- Slice 10: in-game cosmetics (spec §2.3) — catalog, ownership, equipped state.
--
-- Points are spent through ONE shared path (hard rule 6): spend_points() is the
-- single implementation of the atomic balance-check + negative-ledger-write.
-- Both redeem_reward (refactored) and the new purchase_cosmetic call it.

-- ---------------------------------------------------------------------------
-- 1. Shared points-spend helper. Private (revoked from all client roles);
--    assumes the caller already holds the per-user streaks FOR UPDATE lock, so
--    the check + deduct is atomic within the caller's serialized transaction.
-- ---------------------------------------------------------------------------
create or replace function public.spend_points(
  p_user   uuid,
  p_amount integer,
  p_action text,
  p_ref    uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  select coalesce(sum(points), 0) into v_balance
  from public.xp_ledger where user_id = p_user;

  if v_balance < p_amount then
    raise exception 'insufficient_balance';
  end if;

  insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
  values (p_user, p_action, 0, -p_amount, p_ref,
          (now() at time zone 'America/Mexico_City')::date);

  return v_balance - p_amount;
end;
$$;

revoke execute on function public.spend_points(uuid, integer, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Refactor redeem_reward (Slice 9) to spend through spend_points.
--    Behaviour-identical: same guards, same negative ledger row + redeemed_at.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_reward  public.rewards%rowtype;
  v_after   integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from public.streaks where user_id = v_user for update;

  select * into v_reward
  from public.rewards
  where id = p_reward_id and user_id = v_user;

  if not found then raise exception 'reward_not_found'; end if;
  if v_reward.archived_at is not null then raise exception 'reward_archived'; end if;
  if v_reward.redeemed_at is not null then raise exception 'already_redeemed'; end if;

  v_after := public.spend_points(v_user, v_reward.cost_points, 'reward_redemption', v_reward.id);
  update public.rewards set redeemed_at = now() where id = v_reward.id;

  return jsonb_build_object(
    'reward_id', v_reward.id,
    'cost', v_reward.cost_points,
    'balance_before', v_after + v_reward.cost_points,
    'balance_after', v_after,
    'redeemed_at', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Cosmetics catalog — global, seeded, read-only for clients.
-- ---------------------------------------------------------------------------
create table public.cosmetics (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  type        text not null check (type in ('title', 'theme', 'gear')),
  cost_points integer not null check (cost_points > 0),
  metadata    jsonb not null default '{}',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.cosmetics enable row level security;
create policy "Cosmetics are readable by everyone"
  on public.cosmetics for select using (true);
-- No write policies: the catalog is immutable from clients.

-- Ownership: written only by purchase_cosmetic (points were spent → rule 6).
create table public.cosmetic_unlocks (
  user_id     uuid not null references auth.users (id) on delete cascade,
  cosmetic_id uuid not null references public.cosmetics (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

alter table public.cosmetic_unlocks enable row level security;
create policy "Cosmetic unlocks: owner select"
  on public.cosmetic_unlocks for select using (user_id = auth.uid());
-- No client insert/update/delete (definer purchase writes it).

-- Equipped: free to change, so normal RLS — but you can only equip what you own.
create table public.cosmetic_equipped (
  user_id     uuid not null references auth.users (id) on delete cascade,
  cosmetic_id uuid not null references public.cosmetics (id) on delete cascade,
  equipped_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

alter table public.cosmetic_equipped enable row level security;
create policy "Cosmetic equipped: owner select"
  on public.cosmetic_equipped for select using (user_id = auth.uid());
create policy "Cosmetic equipped: owner insert (must own)"
  on public.cosmetic_equipped for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.cosmetic_unlocks cu
      where cu.user_id = auth.uid() and cu.cosmetic_id = cosmetic_equipped.cosmetic_id
    )
  );
create policy "Cosmetic equipped: owner delete"
  on public.cosmetic_equipped for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. purchase_cosmetic — spends points and grants ownership.
-- ---------------------------------------------------------------------------
create or replace function public.purchase_cosmetic(p_cosmetic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_cosmetic public.cosmetics%rowtype;
  v_after    integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  perform 1 from public.streaks where user_id = v_user for update;

  select * into v_cosmetic from public.cosmetics where id = p_cosmetic_id;
  if not found then raise exception 'cosmetic_not_found'; end if;

  if exists (
    select 1 from public.cosmetic_unlocks
    where user_id = v_user and cosmetic_id = p_cosmetic_id
  ) then
    raise exception 'already_owned';
  end if;

  v_after := public.spend_points(v_user, v_cosmetic.cost_points, 'cosmetic_purchase', v_cosmetic.id);

  insert into public.cosmetic_unlocks (user_id, cosmetic_id)
  values (v_user, v_cosmetic.id);

  return jsonb_build_object(
    'cosmetic_id', v_cosmetic.id,
    'cost', v_cosmetic.cost_points,
    'balance_after', v_after
  );
end;
$$;

revoke execute on function public.purchase_cosmetic(uuid) from public, anon;
grant execute on function public.purchase_cosmetic(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Seed the v1 catalog (spec §2.3 examples; costs ≈ 1 pt / committed action).
-- ---------------------------------------------------------------------------
insert into public.cosmetics (slug, name, type, cost_points, metadata, sort_order) values
  ('bar-tyrant',        'Bar Tyrant',        'title', 300,  '{}',                                  10),
  ('iron-monk',         'Iron Monk',         'title', 300,  '{}',                                  11),
  ('calisthenics-king', 'Calisthenics King', 'title', 800,  '{}',                                  12),
  ('ember',             'Ember',             'theme', 200,  '{"accent":"oklch(0.62 0.19 29)"}',    20),
  ('frost',             'Frost',             'theme', 200,  '{"accent":"oklch(0.60 0.13 240)"}',   21),
  ('void',              'Void',              'theme', 500,  '{"accent":"oklch(0.50 0.16 300)"}',   22),
  ('wrist-wraps',       'Wrist Wraps',       'gear',  100,  '{"slot":"wrist"}',                    30),
  ('lifting-belt',      'Lifting Belt',      'gear',  150,  '{"slot":"belt"}',                     31),
  ('warrior-headband',  'Warrior Headband',  'gear',  150,  '{"slot":"head"}',                     32),
  ('champion-aura',     'Champion Aura',     'gear',  1000, '{"slot":"aura"}',                     33);
