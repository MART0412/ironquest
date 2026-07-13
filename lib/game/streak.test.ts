import { describe, expect, it } from "vitest"

import {
  addDays,
  applyMultiplier,
  evaluateStreak,
  mxDateOf,
  multiplierFor,
  weekdayOf,
  workoutAward,
  type DayStatus,
} from "./streak"

/** Build a statusOf callback from a sparse map; unlisted days are misses. */
function statusMap(map: Record<string, DayStatus>) {
  return (date: string): DayStatus => map[date] ?? "miss"
}

describe("mexico city day boundary", () => {
  // Mexico City is UTC-6 year-round (DST abolished 2022).
  it("assigns instants around midnight to the correct MX calendar day", () => {
    expect(mxDateOf(new Date("2026-07-13T05:59:59Z"))).toBe("2026-07-12") // 23:59:59 MX
    expect(mxDateOf(new Date("2026-07-13T06:00:00Z"))).toBe("2026-07-13") // 00:00:00 MX
  })

  it("a workout just before MX midnight extends that day; just after starts the next", () => {
    const prev = { start: "2026-07-10", len: 3, best: 3 } // covers Jul 10–12

    // 23:59 MX on Jul 12 → same last day, no change.
    const lateNight = evaluateStreak(
      prev,
      mxDateOf(new Date("2026-07-13T05:59:00Z")),
      statusMap({})
    )
    expect(lateNight.len).toBe(3)

    // 00:01 MX on Jul 13 → consecutive next day, extends.
    const afterMidnight = evaluateStreak(
      prev,
      mxDateOf(new Date("2026-07-13T06:01:00Z")),
      statusMap({})
    )
    expect(afterMidnight.len).toBe(4)
    expect(afterMidnight.reset).toBe(false)
  })

  it("weekdayOf maps dates correctly", () => {
    expect(weekdayOf("2026-07-13")).toBe("mon")
    expect(weekdayOf("2026-07-12")).toBe("sun")
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01")
  })
})

describe("rest-day counting (spec §2.2)", () => {
  // Streak covers Mon Jul 6 – Fri Jul 10; weekend is unscheduled rest.
  const prev = { start: "2026-07-06", len: 5, best: 5 }

  it("extends through scheduled rest days when meals were logged", () => {
    const result = evaluateStreak(
      prev,
      "2026-07-13", // Monday workout after the weekend
      statusMap({ "2026-07-11": "rest_ok", "2026-07-12": "rest_ok" })
    )
    expect(result.reset).toBe(false)
    expect(result.len).toBe(8) // 5 + sat + sun + monday
    expect(result.start).toBe("2026-07-06")
    expect(result.crossedMilestones).toEqual([7]) // gap-fill crossed the 7-day mark
  })

  it("resets when a rest day had no meals logged (hardcore)", () => {
    const result = evaluateStreak(
      prev,
      "2026-07-13",
      statusMap({ "2026-07-11": "rest_ok", "2026-07-12": "miss" })
    )
    expect(result.reset).toBe(true)
    expect(result.len).toBe(1)
    expect(result.start).toBe("2026-07-13")
    expect(result.crossedMilestones).toEqual([])
  })

  it("resets when a scheduled training day was skipped, even with meals (hardcore)", () => {
    // statusOf already encodes the rule: a scheduled day without a workout is
    // a miss regardless of meals — the engine sees "miss" and resets.
    const result = evaluateStreak(
      prev,
      "2026-07-14",
      statusMap({
        "2026-07-11": "rest_ok",
        "2026-07-12": "rest_ok",
        "2026-07-13": "miss", // Monday: scheduled, skipped, meals logged anyway
      })
    )
    expect(result.reset).toBe(true)
    expect(result.len).toBe(1)
  })

  it("counts a trained day inside a gap", () => {
    const result = evaluateStreak(
      prev,
      "2026-07-12",
      statusMap({ "2026-07-11": "trained" })
    )
    expect(result.len).toBe(7)
    expect(result.crossedMilestones).toEqual([7])
  })
})

describe("streak reset preserves XP (spec §2.2)", () => {
  it("a reset only rewrites start/len — best survives, nothing is deducted", () => {
    const prev = { start: "2026-06-01", len: 25, best: 25 }
    const result = evaluateStreak(prev, "2026-07-13", statusMap({}))

    expect(result.reset).toBe(true)
    expect(result.len).toBe(1)
    expect(result.best).toBe(25) // best_len survives the reset
    // The update carries no XP semantics at all: no milestone (nothing crossed),
    // and by design the engine never emits negative ledger entries.
    expect(result.crossedMilestones).toEqual([])
  })

  it("awards after a reset are computed at base ×1.0", () => {
    expect(applyMultiplier(100, 1)).toBe(100)
  })
})

describe("multiplier (spec §2.2)", () => {
  it("grows +0.05 per full week and caps at 1.5", () => {
    expect(multiplierFor(1)).toBe(1.0)
    expect(multiplierFor(6)).toBe(1.0)
    expect(multiplierFor(7)).toBe(1.05)
    expect(multiplierFor(13)).toBe(1.05)
    expect(multiplierFor(14)).toBe(1.1)
    expect(multiplierFor(70)).toBe(1.5)
    expect(multiplierFor(700)).toBe(1.5) // cap
  })

  it("applies to all XP awards, rounded", () => {
    expect(applyMultiplier(100, 7)).toBe(105)
    expect(applyMultiplier(50, 7)).toBe(53) // 52.5 rounds up
    expect(applyMultiplier(100, 70)).toBe(150)
  })
})

describe("workout award (spec §2.1)", () => {
  it("scheduled routine, first completion today → 100/10", () => {
    expect(
      workoutAward({
        isScheduledRoutineToday: true,
        routineAlreadyCompletedToday: false,
        bonusAlreadyAwardedToday: false,
      })
    ).toEqual({ action: "scheduled_workout", baseXp: 100, points: 10 })
  })

  it("re-completing the same routine falls through to bonus", () => {
    expect(
      workoutAward({
        isScheduledRoutineToday: true,
        routineAlreadyCompletedToday: true,
        bonusAlreadyAwardedToday: false,
      })
    ).toEqual({ action: "bonus_workout", baseXp: 50, points: 5 })
  })

  it("unscheduled workout is a bonus, capped at one per day", () => {
    expect(
      workoutAward({
        isScheduledRoutineToday: false,
        routineAlreadyCompletedToday: false,
        bonusAlreadyAwardedToday: false,
      })
    ).toEqual({ action: "bonus_workout", baseXp: 50, points: 5 })

    expect(
      workoutAward({
        isScheduledRoutineToday: false,
        routineAlreadyCompletedToday: false,
        bonusAlreadyAwardedToday: true,
      })
    ).toBeNull()
  })

  it("milestones cross every 7 days, including multiples in one gap-fill", () => {
    const result = evaluateStreak(
      { start: "2026-06-01", len: 12, best: 12 }, // covers Jun 1–12
      "2026-06-16",
      statusMap({
        "2026-06-13": "rest_ok",
        "2026-06-14": "rest_ok",
        "2026-06-15": "trained",
      })
    )
    expect(result.len).toBe(16)
    expect(result.crossedMilestones).toEqual([14])
  })
})
