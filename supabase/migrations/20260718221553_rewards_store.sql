-- Slice 9: points store — real-life rewards (spec §2.3).
-- Reward CRUD stays on the RLS owner policies (Slice 2). Only the redemption,
-- which deducts points, needs a SECURITY DEFINER function: xp_ledger is
-- SELECT-only for clients (hard rule 6), so redeem_reward is its sole writer.

-- Additive columns: an optional note and a soft-archive flag.
alter table public.rewards add column note text;
alter table public.rewards add column archived_at timestamptz;

-- ---------------------------------------------------------------------------
-- redeem_reward: atomically checks balance and writes the deduction.
--
-- The per-user FOR UPDATE lock on streaks (same mutex complete_workout and
-- log_meal use) serializes all of a user's point mutations, so the
-- balance-check + deduct is atomic — concurrent redemptions can't overspend or
-- double-claim. Balance = sum(xp_ledger.points); a redemption is a negative row.
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
  v_balance integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  -- Serialize this user's point mutations before reading balance.
  perform 1 from public.streaks where user_id = v_user for update;

  select * into v_reward
  from public.rewards
  where id = p_reward_id and user_id = v_user;

  if not found then
    raise exception 'reward_not_found';
  end if;
  if v_reward.archived_at is not null then
    raise exception 'reward_archived';
  end if;
  if v_reward.redeemed_at is not null then
    raise exception 'already_redeemed';
  end if;

  select coalesce(sum(points), 0) into v_balance
  from public.xp_ledger
  where user_id = v_user;

  if v_balance < v_reward.cost_points then
    raise exception 'insufficient_balance';
  end if;

  insert into public.xp_ledger (user_id, action, xp, points, ref_id, ref_date)
  values (
    v_user, 'reward_redemption', 0, -v_reward.cost_points, v_reward.id,
    (now() at time zone 'America/Mexico_City')::date
  );

  update public.rewards set redeemed_at = now() where id = v_reward.id;

  return jsonb_build_object(
    'reward_id', v_reward.id,
    'cost', v_reward.cost_points,
    'balance_before', v_balance,
    'balance_after', v_balance - v_reward.cost_points,
    'redeemed_at', now()
  );
end;
$$;

revoke execute on function public.redeem_reward(uuid) from public, anon;
grant execute on function public.redeem_reward(uuid) to authenticated;
