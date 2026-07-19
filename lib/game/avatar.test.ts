import { describe, expect, it } from "vitest"

import { baseFigureForLevel, orderGear } from "./avatar"

describe("baseFigureForLevel (kept 0/5/10/20 thresholds)", () => {
  it("maps levels to the right tier", () => {
    expect(baseFigureForLevel(0).key).toBe("seedling")
    expect(baseFigureForLevel(4).key).toBe("seedling")
    expect(baseFigureForLevel(5).key).toBe("novice")
    expect(baseFigureForLevel(9).key).toBe("novice")
    expect(baseFigureForLevel(10).key).toBe("warrior")
    expect(baseFigureForLevel(19).key).toBe("warrior")
    expect(baseFigureForLevel(20).key).toBe("champion")
    expect(baseFigureForLevel(100).key).toBe("champion")
  })
})

describe("orderGear (deterministic layer order)", () => {
  it("sorts slots by draw order regardless of input order", () => {
    expect(orderGear(["head", "aura", "belt"])).toEqual(["aura", "belt", "head"])
    expect(orderGear(["belt", "head", "aura", "wrist"])).toEqual([
      "aura",
      "belt",
      "wrist",
      "head",
    ])
  })

  it("drops unknown slots and de-dupes", () => {
    expect(orderGear(["cape", "belt", "belt", "nope"])).toEqual(["belt"])
    expect(orderGear([])).toEqual([])
  })
})
