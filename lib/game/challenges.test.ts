import { describe, expect, it } from "vitest"

import {
  CASCADE_XP_RATE,
  cascadeAwards,
  hasOpenChallenge,
  meetsReadiness,
  shouldOfferChallenge,
} from "./challenges"
import type { LoggedSet, UnlockCriteria } from "./skills"

const reps = (...values: number[]): LoggedSet[] =>
  values.map((r) => ({ reps: r, seconds: null }))
const holds = (...values: number[]): LoggedSet[] =>
  values.map((s) => ({ reps: null, seconds: s }))

const repTarget: UnlockCriteria = { kind: "reps", sets: 3, reps: 6 }
const holdTarget: UnlockCriteria = { kind: "hold", sets: 3, seconds: 15 }

describe("meetsReadiness", () => {
  it("qualifies when the logged numbers reach the harder node's target", () => {
    // 3×8 pull-ups numerically satisfies a 3×6 target.
    expect(meetsReadiness(reps(8, 8, 8), repTarget)).toBe(true)
    expect(meetsReadiness(reps(6, 6, 6), repTarget)).toBe(true) // exactly
  })

  it("does not qualify when short by one set or one rep", () => {
    expect(meetsReadiness(reps(8, 8), repTarget)).toBe(false)
    expect(meetsReadiness(reps(8, 8, 5), repTarget)).toBe(false)
  })

  it("never qualifies across a criteria-kind mismatch", () => {
    expect(meetsReadiness(reps(30, 30, 30), holdTarget)).toBe(false)
    expect(meetsReadiness(holds(30, 30, 30), repTarget)).toBe(false)
  })

  it("qualifies hold targets on seconds", () => {
    expect(meetsReadiness(holds(20, 18, 16), holdTarget)).toBe(true)
    expect(meetsReadiness(holds(20, 18, 14), holdTarget)).toBe(false)
  })
})

describe("shouldOfferChallenge", () => {
  const base = {
    loggedSets: reps(8, 8, 8),
    targetCriteria: repTarget,
    targetUnlocked: false,
    prerequisiteSatisfied: true,
    alreadyOfferedThisSession: false,
  }

  it("offers when every condition holds", () => {
    expect(shouldOfferChallenge(base)).toBe(true)
  })

  it("does not offer when the criteria are not met", () => {
    expect(shouldOfferChallenge({ ...base, loggedSets: reps(5, 5, 5) })).toBe(false)
  })

  it("does not offer a node that is already unlocked", () => {
    expect(shouldOfferChallenge({ ...base, targetUnlocked: true })).toBe(false)
  })

  it("does not offer when the path prerequisite is unmet", () => {
    expect(shouldOfferChallenge({ ...base, prerequisiteSatisfied: false })).toBe(false)
  })

  it("does not double-offer the same node in one session", () => {
    expect(shouldOfferChallenge({ ...base, alreadyOfferedThisSession: true })).toBe(false)
  })

  it("does not offer a node without criteria", () => {
    expect(shouldOfferChallenge({ ...base, targetCriteria: null })).toBe(false)
  })
})

describe("cascadeAwards (fast-track skipped nodes)", () => {
  it("credits skipped nodes at the reduced rate", () => {
    const a = cascadeAwards(3)
    expect(CASCADE_XP_RATE).toBe(0.25)
    expect(a.perNodeXp).toBe(50) // 200 × 0.25
    expect(a.perNodePoints).toBe(6) // round(25 × 0.25)
    expect(a.count).toBe(3)
    expect(a.totalXp).toBe(150)
    expect(a.totalPoints).toBe(18)
  })

  it("applies the streak multiplier to XP but not to points", () => {
    const a = cascadeAwards(2, 1.5)
    expect(a.perNodeXp).toBe(75) // round(200 × 0.25 × 1.5)
    expect(a.perNodePoints).toBe(6) // unchanged
    expect(a.totalXp).toBe(150)
  })

  it("is zero when nothing is skipped", () => {
    const a = cascadeAwards(0)
    expect(a.count).toBe(0)
    expect(a.totalXp).toBe(0)
    expect(a.totalPoints).toBe(0)
  })

  it("never credits a negative count", () => {
    expect(cascadeAwards(-5).count).toBe(0)
    expect(cascadeAwards(-5).totalXp).toBe(0)
  })

  it("stays below a full unlock per skipped node", () => {
    expect(cascadeAwards(1).perNodeXp).toBeLessThan(200)
  })
})

describe("hasOpenChallenge (badge persistence)", () => {
  it("keeps the badge for ready, declined and failed", () => {
    expect(hasOpenChallenge("ready")).toBe(true)
    expect(hasOpenChallenge("declined")).toBe(true) // decline persists the badge
    expect(hasOpenChallenge("failed")).toBe(true) // retryable
  })

  it("drops the badge once completed or absent", () => {
    expect(hasOpenChallenge("completed")).toBe(false)
    expect(hasOpenChallenge(null)).toBe(false)
    expect(hasOpenChallenge(undefined)).toBe(false)
  })
})
