import { describe, expect, it } from "vitest"

import {
  detectPR,
  isUnlockable,
  meetsCriteria,
  type LoggedSet,
  type UnlockCriteria,
} from "./skills"

const reps = (...values: number[]): LoggedSet[] =>
  values.map((r) => ({ reps: r, seconds: null }))
const holds = (...values: number[]): LoggedSet[] =>
  values.map((s) => ({ reps: null, seconds: s }))

describe("meetsCriteria", () => {
  const c: UnlockCriteria = { kind: "reps", sets: 3, reps: 8 }

  it("passes at the exact threshold (3 sets of exactly 8 meets 3×8)", () => {
    expect(meetsCriteria(c, reps(8, 8, 8))).toBe(true)
  })

  it("fails when short by one set", () => {
    expect(meetsCriteria(c, reps(8, 8))).toBe(false)
  })

  it("fails when one set is short by a single rep", () => {
    expect(meetsCriteria(c, reps(8, 8, 7))).toBe(false)
  })

  it("passes with extra sets and extra reps", () => {
    expect(meetsCriteria(c, reps(12, 10, 9, 8))).toBe(true)
  })

  it("ignores hold-only sets when the criterion is reps-based", () => {
    expect(meetsCriteria(c, holds(30, 30, 30))).toBe(false)
  })

  it("evaluates hold-time criteria by seconds", () => {
    const hold: UnlockCriteria = { kind: "hold", sets: 3, seconds: 20 }
    expect(meetsCriteria(hold, holds(20, 25, 30))).toBe(true)
    expect(meetsCriteria(hold, holds(20, 19, 30))).toBe(false)
    expect(meetsCriteria(hold, reps(20, 20, 20))).toBe(false) // reps don't count
  })
})

describe("isUnlockable (prerequisite gating)", () => {
  it("unlocks a tier-1 node (no prereq) when criteria are met", () => {
    expect(
      isUnlockable({ criteriaMet: true, alreadyUnlocked: false, prereqUnlocked: null })
    ).toBe(true)
  })

  it("blocks a higher tier when its prerequisite is locked", () => {
    expect(
      isUnlockable({ criteriaMet: true, alreadyUnlocked: false, prereqUnlocked: false })
    ).toBe(false)
  })

  it("allows a higher tier once its prerequisite is unlocked", () => {
    expect(
      isUnlockable({ criteriaMet: true, alreadyUnlocked: false, prereqUnlocked: true })
    ).toBe(true)
  })

  it("never re-unlocks an already-unlocked node", () => {
    expect(
      isUnlockable({ criteriaMet: true, alreadyUnlocked: true, prereqUnlocked: null })
    ).toBe(false)
  })

  it("does not unlock when criteria are unmet", () => {
    expect(
      isUnlockable({ criteriaMet: false, alreadyUnlocked: false, prereqUnlocked: true })
    ).toBe(false)
  })
})

describe("detectPR", () => {
  it("awards when strictly greater than the prior best", () => {
    expect(detectPR({ reps: 12, seconds: null }, { reps: 10, seconds: null })).toEqual({
      metric: "reps",
      value: 12,
    })
  })

  it("does not award on an equal effort (not a record)", () => {
    expect(detectPR({ reps: 12, seconds: null }, { reps: 12, seconds: null })).toBeNull()
  })

  it("does not award below the prior best", () => {
    expect(detectPR({ reps: 9, seconds: null }, { reps: 10, seconds: null })).toBeNull()
  })

  it("does not award on a first-ever log (no baseline)", () => {
    expect(detectPR({ reps: 20, seconds: null }, { reps: null, seconds: null })).toBeNull()
  })

  it("detects hold-time records by seconds", () => {
    expect(detectPR({ reps: null, seconds: 45 }, { reps: null, seconds: 30 })).toEqual({
      metric: "seconds",
      value: 45,
    })
    expect(detectPR({ reps: null, seconds: 30 }, { reps: null, seconds: 30 })).toBeNull()
  })

  it("prefers the reps metric when both improve", () => {
    expect(detectPR({ reps: 12, seconds: 40 }, { reps: 10, seconds: 30 })).toEqual({
      metric: "reps",
      value: 12,
    })
  })
})
