// Pure reward-redemption rules (spec §2.3). Tested specification of the guard
// order inside the redeem_reward SQL function (the sole writer of the points
// deduction, rule 6). Keep the two in lockstep.

export type RedemptionResult =
  | "ok"
  | "reward_archived"
  | "already_redeemed"
  | "insufficient_balance"

/**
 * Decide whether a redemption is allowed. Guard order matches the SQL:
 * archived and already-redeemed are terminal states of the reward and take
 * precedence over the balance check.
 */
export function redemptionCheck(input: {
  balance: number
  cost: number
  archivedAt: string | null
  redeemedAt: string | null
}): RedemptionResult {
  if (input.redeemedAt) return "already_redeemed"
  if (input.archivedAt) return "reward_archived"
  if (input.balance < input.cost) return "insufficient_balance"
  return "ok"
}

/**
 * Fold a set of redemptions against a starting balance **serially** — which is
 * exactly what the per-user FOR UPDATE lock in redeem_reward guarantees at the
 * database level. Because each redemption sees the balance left by the previous
 * one, the balance can never go negative: concurrent redemptions can't
 * double-spend. (The real lock is proven by the live concurrency E2E; this
 * models the invariant for unit testing.)
 */
export function applyRedemptions(
  startBalance: number,
  costs: number[]
): { balance: number; results: RedemptionResult[] } {
  let balance = startBalance
  const results: RedemptionResult[] = []
  for (const cost of costs) {
    const result = redemptionCheck({
      balance,
      cost,
      archivedAt: null,
      redeemedAt: null,
    })
    results.push(result)
    if (result === "ok") balance -= cost
  }
  return { balance, results }
}
