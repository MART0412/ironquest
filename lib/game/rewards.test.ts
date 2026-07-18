import { describe, expect, it } from "vitest"

import { applyRedemptions, redemptionCheck } from "./rewards"

describe("redemptionCheck", () => {
  const active = { archivedAt: null, redeemedAt: null }

  it("allows a redemption when balance covers the cost", () => {
    expect(redemptionCheck({ balance: 800, cost: 500, ...active })).toBe("ok")
    expect(redemptionCheck({ balance: 500, cost: 500, ...active })).toBe("ok") // exact
  })

  it("rejects insufficient balance", () => {
    expect(redemptionCheck({ balance: 499, cost: 500, ...active })).toBe(
      "insufficient_balance"
    )
    expect(redemptionCheck({ balance: 0, cost: 1, ...active })).toBe(
      "insufficient_balance"
    )
  })

  it("rejects an archived reward (even with ample balance)", () => {
    expect(
      redemptionCheck({
        balance: 10000,
        cost: 500,
        archivedAt: "2026-07-18T00:00:00Z",
        redeemedAt: null,
      })
    ).toBe("reward_archived")
  })

  it("rejects an already-redeemed reward (takes precedence)", () => {
    expect(
      redemptionCheck({
        balance: 10000,
        cost: 500,
        archivedAt: "2026-07-18T00:00:00Z",
        redeemedAt: "2026-07-18T00:00:00Z",
      })
    ).toBe("already_redeemed")
  })
})

describe("applyRedemptions (no double-spend under concurrency)", () => {
  it("lets only one of two equal-cost redemptions through when funds cover one", () => {
    const { balance, results } = applyRedemptions(500, [500, 500])
    expect(results).toEqual(["ok", "insufficient_balance"])
    expect(balance).toBe(0) // never negative
  })

  it("settles a queue serially against the running balance", () => {
    const { balance, results } = applyRedemptions(1000, [400, 400, 400])
    expect(results).toEqual(["ok", "ok", "insufficient_balance"])
    expect(balance).toBe(200)
  })

  it("is a no-op with no redemptions", () => {
    expect(applyRedemptions(300, [])).toEqual({ balance: 300, results: [] })
  })
})
