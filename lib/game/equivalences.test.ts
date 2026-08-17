import { describe, expect, it } from "vitest"

import {
  aggregateLifetime,
  achievedMilestones,
  allMilestones,
  convertMetric,
  crossedMilestones,
  DEFAULT_BODYWEIGHT_KG,
  EMPTY_TOTALS,
  FAMILY_BY_SLUG,
  FAMILY_SLUGS,
  formatConversion,
  METRICS,
  METRIC_BY_KEY,
  metricOfMilestone,
  milestoneById,
  nextMilestone,
  type LifetimeSet,
  type LifetimeTotals,
} from "./equivalences"

const ctx = { bodyweightKg: DEFAULT_BODYWEIGHT_KG }

const reps = (family: LifetimeSet["family"], count: number): LifetimeSet => ({
  family,
  reps: count,
  seconds: null,
})
const hold = (family: LifetimeSet["family"], seconds: number): LifetimeSet => ({
  family,
  reps: null,
  seconds,
})

const totals = (over: Partial<LifetimeTotals>): LifetimeTotals => ({
  ...EMPTY_TOTALS,
  ...over,
})

describe("aggregateLifetime", () => {
  it("sums reps into their own family only", () => {
    const result = aggregateLifetime({
      sets: [reps("pull", 8), reps("pull", 6), reps("push", 20), reps("squat", 15)],
      workouts: 3,
    })
    expect(result.pull_reps).toBe(14)
    expect(result.push_reps).toBe(20)
    expect(result.squat_reps).toBe(15)
    expect(result.core_reps).toBe(0)
    expect(result.workouts).toBe(3)
  })

  it("counts hold seconds across every family", () => {
    const result = aggregateLifetime({
      sets: [hold("core", 30), hold("push", 20), hold("other", 45), hold(null, 5)],
      workouts: 1,
    })
    expect(result.hold_seconds).toBe(100)
  })

  it("keeps reps and seconds in separate metrics", () => {
    const result = aggregateLifetime({
      sets: [reps("pull", 10), hold("pull", 30)],
      workouts: 1,
    })
    expect(result.pull_reps).toBe(10)
    expect(result.hold_seconds).toBe(30)
  })

  it("ignores an unmapped family for rep metrics", () => {
    const result = aggregateLifetime({ sets: [reps("other", 50)], workouts: 1 })
    for (const metric of METRICS) {
      if (metric.measure === "reps") expect(result[metric.key]).toBe(0)
    }
  })

  it("ignores null and non-positive values", () => {
    const result = aggregateLifetime({
      sets: [
        { family: "pull", reps: null, seconds: null },
        { family: "pull", reps: 0, seconds: null },
        reps("pull", 5),
      ],
      workouts: 0,
    })
    expect(result.pull_reps).toBe(5)
  })

  it("starts from zero on an empty history", () => {
    expect(aggregateLifetime({ sets: [], workouts: 0 })).toEqual(EMPTY_TOTALS)
  })
})

describe("crossedMilestones", () => {
  it("fires when a threshold is passed", () => {
    const crossed = crossedMilestones(totals({ pull_reps: 55 }), totals({ pull_reps: 61 }))
    expect(crossed.map((ms) => ms.id)).toEqual(["pull_castillo"])
  })

  it("counts landing exactly on the threshold", () => {
    const crossed = crossedMilestones(totals({ pull_reps: 59 }), totals({ pull_reps: 60 }))
    expect(crossed.map((ms) => ms.id)).toEqual(["pull_castillo"])
  })

  it("returns every rung when one workout clears several", () => {
    const crossed = crossedMilestones(totals({ pull_reps: 0 }), totals({ pull_reps: 220 }))
    expect(crossed.map((ms) => ms.id)).toEqual([
      "pull_castillo",
      "pull_angel",
      "pull_thirty_storeys",
    ])
  })

  it("spans metrics in one evaluation", () => {
    const crossed = crossedMilestones(
      totals({ pull_reps: 50, workouts: 9 }),
      totals({ pull_reps: 65, workouts: 10 })
    )
    expect(crossed.map((ms) => ms.id).sort()).toEqual(["pull_castillo", "workouts_10"])
  })

  it("does not re-fire an already-crossed milestone", () => {
    const crossed = crossedMilestones(totals({ pull_reps: 100 }), totals({ pull_reps: 150 }))
    expect(crossed).toEqual([])
  })

  it("returns nothing when the totals do not move", () => {
    const snapshot = totals({ pull_reps: 601, push_reps: 300 })
    expect(crossedMilestones(snapshot, snapshot)).toEqual([])
  })
})

describe("nextMilestone", () => {
  it("points at the first unearned rung with progress from the previous one", () => {
    // 312 pull-ups: past Torre Latinoamericana's floor (200), short of 366.
    const next = nextMilestone("pull_reps", 312)
    expect(next?.milestone.id).toBe("pull_latino")
    expect(next?.remaining).toBe(54)
    expect(next?.progress).toBeCloseTo((312 - 200) / (366 - 200), 5)
  })

  it("measures the first rung from zero", () => {
    const next = nextMilestone("pull_reps", 30)
    expect(next?.milestone.id).toBe("pull_castillo")
    expect(next?.progress).toBeCloseTo(0.5, 5)
  })

  it("returns null once the ladder is finished", () => {
    expect(nextMilestone("pull_reps", 99_999)).toBeNull()
  })

  it("returns null for a counter-only metric", () => {
    expect(nextMilestone("dip_reps", 500)).toBeNull()
  })

  it("reports the achieved rungs behind it", () => {
    expect(achievedMilestones("pull_reps", 312).map((ms) => ms.id)).toEqual([
      "pull_castillo",
      "pull_angel",
      "pull_thirty_storeys",
    ])
  })
})

describe("conversions", () => {
  it("turns pull-ups into metres climbed", () => {
    expect(convertMetric(METRIC_BY_KEY.pull_reps, 600, ctx)).toBe(300)
    expect(formatConversion(METRIC_BY_KEY.pull_reps, 600, ctx)).toBe("300 m climbed")
  })

  it("scales pressed tonnage with body weight", () => {
    const light = convertMetric(METRIC_BY_KEY.push_reps, 100, { bodyweightKg: 60 })
    const heavy = convertMetric(METRIC_BY_KEY.push_reps, 100, { bodyweightKg: 90 })
    expect(light).toBeCloseTo(3.84, 5)
    expect(heavy).toBeCloseTo(5.76, 5)
    expect(formatConversion(METRIC_BY_KEY.push_reps, 100, { bodyweightKg: 90 })).toBe(
      "5.8 t pressed"
    )
  })

  it("turns squats into floors and holds into minutes", () => {
    expect(convertMetric(METRIC_BY_KEY.squat_reps, 816, ctx)).toBe(102)
    expect(formatConversion(METRIC_BY_KEY.hold_seconds, 3600, ctx)).toBe(
      "60 min under tension"
    )
  })

  it("has no conversion for counters that speak for themselves", () => {
    expect(convertMetric(METRIC_BY_KEY.workouts, 100, ctx)).toBeNull()
    expect(formatConversion(METRIC_BY_KEY.dip_reps, 100, ctx)).toBeNull()
  })
})

describe("catalog integrity", () => {
  it("has unique milestone ids", () => {
    const ids = allMilestones().map((ms) => ms.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("keeps every ladder strictly ascending", () => {
    for (const metric of METRICS) {
      const thresholds = metric.milestones.map((ms) => ms.at)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
      expect(new Set(thresholds).size).toBe(thresholds.length)
    }
  })

  it("awards positive xp and points on every milestone", () => {
    for (const ms of allMilestones()) {
      expect(ms.xp).toBeGreaterThan(0)
      expect(ms.points).toBeGreaterThan(0)
    }
  })

  it("resolves copy and metric by id, and null for anything else", () => {
    expect(milestoneById("pull_eiffel")?.label).toBe("Eiffel Tower")
    expect(metricOfMilestone("pull_eiffel")?.key).toBe("pull_reps")
    expect(milestoneById("not_a_milestone")).toBeNull()
    expect(metricOfMilestone("not_a_milestone")).toBeNull()
  })

  it("maps each slug to exactly one family", () => {
    const slugs = Object.values(FAMILY_SLUGS).flat()
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(FAMILY_BY_SLUG["pull-up"]).toBe("pull")
    expect(FAMILY_BY_SLUG["pistol-squat"]).toBe("squat")
    expect(FAMILY_BY_SLUG["dead-hang"]).toBeUndefined()
  })
})
