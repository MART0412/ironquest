import { describe, expect, it } from "vitest"

import {
  ACTIVITIES,
  ACTIVITY_XP,
  activityBySlug,
  activityPoints,
  activityXp,
  applyDailyCap,
  availableActivities,
  kcalBurned,
  qualifiesForStreak,
} from "./activities"

describe("kcalBurned — the MET formula", () => {
  it("matches the hand-computed figure", () => {
    // 9.8 MET × 3.5 × 80 kg / 200 × 30 min = 411.6
    expect(kcalBurned({ met: 9.8, weightKg: 80, minutes: 30 })).toBeCloseTo(411.6, 4)
  })

  it("scales linearly with each input", () => {
    const base = kcalBurned({ met: 8, weightKg: 70, minutes: 30 })
    expect(kcalBurned({ met: 8, weightKg: 70, minutes: 60 })).toBeCloseTo(base * 2, 6)
    expect(kcalBurned({ met: 16, weightKg: 70, minutes: 30 })).toBeCloseTo(base * 2, 6)
    expect(kcalBurned({ met: 8, weightKg: 140, minutes: 30 })).toBeCloseTo(base * 2, 6)
  })

  it("is zero for non-positive inputs rather than negative", () => {
    expect(kcalBurned({ met: 0, weightKg: 80, minutes: 30 })).toBe(0)
    expect(kcalBurned({ met: 9.8, weightKg: 0, minutes: 30 })).toBe(0)
    expect(kcalBurned({ met: 9.8, weightKg: 80, minutes: 0 })).toBe(0)
    expect(kcalBurned({ met: 9.8, weightKg: 80, minutes: -10 })).toBe(0)
  })
})

describe("activityXp — duration × intensity", () => {
  it("pays the calibrated amounts for the headline sessions", () => {
    // 30-min run at 9.8 MET → 9.8 × 30 × 0.35 = 102.9 → 103
    expect(activityXp({ met: 9.8, minutes: 30 })).toBe(103)
    // 15-min jog at 7 MET → 36.75 → 37
    expect(activityXp({ met: 7, minutes: 15 })).toBe(37)
    // 30-min jump rope at 12 MET → 126
    expect(activityXp({ met: 12, minutes: 30 })).toBe(126)
  })

  it("scales with duration and with intensity", () => {
    expect(activityXp({ met: 8, minutes: 60 })).toBe(
      activityXp({ met: 8, minutes: 30 }) * 2
    )
    expect(activityXp({ met: 16, minutes: 30 })).toBe(
      activityXp({ met: 8, minutes: 30 }) * 2
    )
  })

  it("applies the streak multiplier to XP", () => {
    expect(activityXp({ met: 9.8, minutes: 30, multiplier: 1.5 })).toBe(154)
  })

  it("never multiplies points", () => {
    const base = activityXp({ met: 9.8, minutes: 30 })
    expect(activityPoints(base)).toBe(10)
    // A x1.5 streak pays 154 XP but still only the base 10 points.
    const boosted = activityXp({ met: 9.8, minutes: 30, multiplier: 1.5 })
    expect(activityPoints(boosted, 1.5)).toBe(10)
  })

  it("trims points with the cap, exactly as it trims XP", () => {
    // A session worth 103 that only had 47 of the allowance left pays 5, not 10
    // — otherwise the cap would stop the XP and leave the points farmable.
    expect(activityPoints(47)).toBe(5)
    expect(activityPoints(0)).toBe(0)
  })

  it("is zero for a session with no duration or no intensity", () => {
    expect(activityXp({ met: 9.8, minutes: 0 })).toBe(0)
    expect(activityXp({ met: 0, minutes: 30 })).toBe(0)
  })
})

describe("applyDailyCap", () => {
  it("pays in full when there is room", () => {
    expect(applyDailyCap({ proposed: 103, alreadyToday: 0 })).toEqual({
      awarded: 103,
      capped: false,
      remaining: ACTIVITY_XP.DAILY_CAP - 103,
    })
  })

  it("pays only the remainder when the cap is partly spent", () => {
    // 120 already spent of 150 → only 30 left, though 103 was earned.
    expect(applyDailyCap({ proposed: 103, alreadyToday: 120 })).toEqual({
      awarded: 30,
      capped: true,
      remaining: 0,
    })
  })

  it("pays nothing once the cap is exhausted", () => {
    expect(applyDailyCap({ proposed: 103, alreadyToday: ACTIVITY_XP.DAILY_CAP })).toEqual(
      { awarded: 0, capped: true, remaining: 0 }
    )
  })

  it("treats landing exactly on the cap as uncapped", () => {
    const result = applyDailyCap({ proposed: ACTIVITY_XP.DAILY_CAP, alreadyToday: 0 })
    expect(result).toEqual({
      awarded: ACTIVITY_XP.DAILY_CAP,
      capped: false,
      remaining: 0,
    })
  })

  it("cannot be pushed negative by over-spend or nonsense input", () => {
    expect(applyDailyCap({ proposed: 50, alreadyToday: 999 })).toEqual({
      awarded: 0,
      capped: true,
      remaining: 0,
    })
    expect(applyDailyCap({ proposed: 50, alreadyToday: -20 }).awarded).toBe(50)
  })
})

describe("qualifiesForStreak", () => {
  it("needs the configured minimum", () => {
    expect(qualifiesForStreak(9)).toBe(false)
    expect(qualifiesForStreak(ACTIVITY_XP.STREAK_MIN_MINUTES)).toBe(true)
    expect(qualifiesForStreak(11)).toBe(true)
  })

  it("rejects a token session", () => {
    expect(qualifiesForStreak(2)).toBe(false)
    expect(qualifiesForStreak(0)).toBe(false)
  })
})

describe("the catalog", () => {
  it("has unique slugs and sane values throughout", () => {
    const slugs = ACTIVITIES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const activity of ACTIVITIES) {
      expect(activity.met).toBeGreaterThan(0)
      expect(activity.defaultMinutes).toBeGreaterThan(0)
      expect(activity.defaultMinutes).toBeLessThanOrEqual(120)
    }
  })

  it("ties every endurance activity to a discipline, and no bonus one", () => {
    for (const activity of ACTIVITIES) {
      if (activity.kind === "endurance") expect(activity.disciplineSlug).toBeTruthy()
      else expect(activity.disciplineSlug).toBeUndefined()
    }
  })

  it("resolves a slug, and returns null for one it doesn't know", () => {
    expect(activityBySlug("run")?.met).toBe(9.8)
    expect(activityBySlug("teleporting")).toBeNull()
  })
})

describe("availableActivities", () => {
  it("offers every bonus activity to a calisthenics-only user", () => {
    const available = availableActivities(["calisthenics"])
    expect(available.every((a) => a.kind === "bonus")).toBe(true)
    expect(available.map((a) => a.slug)).toContain("jump-rope")
    expect(available.map((a) => a.slug)).not.toContain("run")
  })

  it("adds the endurance presets once that discipline is active", () => {
    const slugs = availableActivities(["calisthenics", "running"]).map((a) => a.slug)
    expect(slugs).toContain("run")
    expect(slugs).not.toContain("cycling-moderate")
  })

  it("still offers the bonus set to someone with nothing activated", () => {
    expect(availableActivities([]).length).toBe(
      ACTIVITIES.filter((a) => a.kind === "bonus").length
    )
  })
})
