import { describe, expect, it } from "vitest"

import { levelFromXp, xpForLevel } from "./level"

describe("leveling curve (spec §2.1: 500 × N^1.4)", () => {
  it("computes thresholds from the formula", () => {
    expect(xpForLevel(0)).toBe(0)
    expect(xpForLevel(1)).toBe(500)
    expect(xpForLevel(2)).toBe(Math.round(500 * Math.pow(2, 1.4))) // 1320
    expect(xpForLevel(10)).toBe(Math.round(500 * Math.pow(10, 1.4))) // ~12559
  })

  it("levels up exactly at the threshold", () => {
    expect(levelFromXp(0).level).toBe(0)
    expect(levelFromXp(499).level).toBe(0)
    expect(levelFromXp(500).level).toBe(1)
    expect(levelFromXp(1319).level).toBe(1)
    expect(levelFromXp(1320).level).toBe(2)
  })

  it("is monotonic and consistent across a range", () => {
    let prev = 0
    for (let xp = 0; xp <= 20000; xp += 137) {
      const { level, currentThreshold, nextThreshold } = levelFromXp(xp)
      expect(level).toBeGreaterThanOrEqual(prev)
      expect(currentThreshold).toBeLessThanOrEqual(xp)
      expect(nextThreshold).toBeGreaterThan(xp)
      prev = level
    }
  })

  it("reports XP-bar progress correctly", () => {
    // QA fixture: 100 XP → Level 0, 100/500 into the bar.
    const p = levelFromXp(100)
    expect(p.level).toBe(0)
    expect(p.intoLevel).toBe(100)
    expect(p.toNext).toBe(400)
    expect(p.progress).toBeCloseTo(0.2)

    const q = levelFromXp(500)
    expect(q.intoLevel).toBe(0)
    expect(q.progress).toBe(0)
  })

  it("clamps negative and fractional input", () => {
    expect(levelFromXp(-50).level).toBe(0)
    expect(levelFromXp(500.9).level).toBe(1)
  })
})
