import { describe, expect, it } from "vitest"

import { purchaseCheck } from "./cosmetics"

describe("purchaseCheck", () => {
  it("allows a purchase when unowned and affordable", () => {
    expect(purchaseCheck({ owned: false, balance: 300, cost: 300 })).toBe("ok")
    expect(purchaseCheck({ owned: false, balance: 301, cost: 300 })).toBe("ok")
  })

  it("rejects an already-owned cosmetic (takes precedence over balance)", () => {
    expect(purchaseCheck({ owned: true, balance: 100000, cost: 300 })).toBe(
      "already_owned"
    )
  })

  it("rejects insufficient balance", () => {
    expect(purchaseCheck({ owned: false, balance: 299, cost: 300 })).toBe(
      "insufficient_balance"
    )
  })
})
