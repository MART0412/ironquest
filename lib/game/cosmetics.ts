// Pure cosmetic-purchase rules (spec §2.3). Tested specification of the guard
// order inside purchase_cosmetic (which spends points via the shared
// spend_points path, rule 6). Keep in lockstep with the SQL.

export type PurchaseResult = "ok" | "already_owned" | "insufficient_balance"

/**
 * Guard order matches the SQL: ownership is terminal (you can't re-buy a
 * cosmetic you own), checked before the balance.
 */
export function purchaseCheck(input: {
  owned: boolean
  balance: number
  cost: number
}): PurchaseResult {
  if (input.owned) return "already_owned"
  if (input.balance < input.cost) return "insufficient_balance"
  return "ok"
}
