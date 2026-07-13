import { describe, expect, it } from "vitest"

import {
  allMealsLogged,
  immediateAwards,
  proteinTargetHit,
  withinCalorieBand,
} from "./nutrition"

describe("calorie band (spec §2.1: ±5%)", () => {
  // Target 2000 → band is [1900, 2100].
  it("accepts totals exactly at the band edges", () => {
    expect(withinCalorieBand(1900, 2000)).toBe(true)
    expect(withinCalorieBand(2100, 2000)).toBe(true)
    expect(withinCalorieBand(2000, 2000)).toBe(true)
  })

  it("rejects totals just outside the band", () => {
    expect(withinCalorieBand(1899, 2000)).toBe(false)
    expect(withinCalorieBand(2101, 2000)).toBe(false)
  })

  it("never fires without a target", () => {
    expect(withinCalorieBand(0, 0)).toBe(false)
    expect(withinCalorieBand(2000, 0)).toBe(false)
  })
})

describe("protein target", () => {
  it("hits exactly at the target and above", () => {
    expect(proteinTargetHit(160, 160)).toBe(true)
    expect(proteinTargetHit(200, 160)).toBe(true)
    expect(proteinTargetHit(159.9, 160)).toBe(false)
  })

  it("never fires without a target", () => {
    expect(proteinTargetHit(100, 0)).toBe(false)
  })
})

describe("all meals logged (3+ entries)", () => {
  it("fires on the third entry", () => {
    expect(allMealsLogged(2)).toBe(false)
    expect(allMealsLogged(3)).toBe(true)
    expect(allMealsLogged(7)).toBe(true)
  })
})

describe("immediate awards", () => {
  const base = { proteinTargetG: 160, alreadyAwarded: new Set<never>() }

  it("awards nothing below both thresholds", () => {
    expect(
      immediateAwards({ ...base, dayProteinG: 80, dayEntryCount: 2 })
    ).toEqual([])
  })

  it("awards both when both cross on the same log", () => {
    const awards = immediateAwards({ ...base, dayProteinG: 165, dayEntryCount: 3 })
    expect(awards.map((a) => a.action)).toEqual([
      "protein_target",
      "meals_logged",
    ])
    expect(awards.find((a) => a.action === "protein_target")).toMatchObject({
      baseXp: 40,
      points: 4,
    })
    expect(awards.find((a) => a.action === "meals_logged")).toMatchObject({
      baseXp: 20,
      points: 2,
    })
  })

  it("dedupes already-awarded actions (one per day)", () => {
    const awards = immediateAwards({
      dayProteinG: 200,
      dayEntryCount: 5,
      proteinTargetG: 160,
      alreadyAwarded: new Set(["protein_target", "meals_logged"] as const),
    })
    expect(awards).toEqual([])
  })
})
