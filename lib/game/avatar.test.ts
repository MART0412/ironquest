import { describe, expect, it } from "vitest"

import { baseFigureForLevel, orderGear, resolveCharacter } from "./avatar"

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

describe("resolveCharacter", () => {
  it("prefers an explicit avatar choice over sex", () => {
    expect(resolveCharacter("male", "woman")).toBe("woman")
    expect(resolveCharacter("female", "man")).toBe("man")
  })

  it("derives from sex when no explicit choice", () => {
    expect(resolveCharacter("male", null)).toBe("man")
    expect(resolveCharacter("female", null)).toBe("woman")
    expect(resolveCharacter("female", undefined)).toBe("woman")
  })

  it("defaults to man when nothing is known or value is junk", () => {
    expect(resolveCharacter(null, null)).toBe("man")
    expect(resolveCharacter(undefined, undefined)).toBe("man")
    expect(resolveCharacter("other", "nonbinary")).toBe("man")
  })
})
