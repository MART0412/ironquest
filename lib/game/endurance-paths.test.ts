import { describe, expect, it } from "vitest"

import { allEnduranceNodes, ENDURANCE_PATHS, QUALIFYING_ACTIVITIES } from "./endurance-paths"
import {
  isEnduranceCriteria,
  meetsCriteria,
  meetsEnduranceCriteria,
  pacePerKm,
  type LoggedSession,
  type UnlockCriteria,
} from "./skills"

const TODAY = "2026-08-27"

const session = (over: Partial<LoggedSession> = {}): LoggedSession => ({
  activitySlug: "run",
  durationMin: 30,
  distanceKm: 5,
  date: TODAY,
  ...over,
})

const distance = (km: number): UnlockCriteria => ({
  kind: "distance",
  activities: ["run", "jog"],
  km,
})
const pace = (minKm: number, maxPacePerKm: number): UnlockCriteria => ({
  kind: "pace",
  activities: ["run", "jog"],
  minKm,
  maxPacePerKm,
})
const frequency = (count: number, windowDays: number): UnlockCriteria => ({
  kind: "frequency",
  activities: ["run", "jog"],
  count,
  windowDays,
})

/** n days before TODAY, as an ISO date. */
const daysAgo = (n: number) => {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

describe("distance criteria", () => {
  it("clears at, and over, the threshold", () => {
    expect(meetsEnduranceCriteria(distance(5), [session({ distanceKm: 5 })], TODAY)).toBe(true)
    expect(meetsEnduranceCriteria(distance(5), [session({ distanceKm: 7.4 })], TODAY)).toBe(true)
  })

  it("does not clear just under it", () => {
    expect(meetsEnduranceCriteria(distance(5), [session({ distanceKm: 4.99 })], TODAY)).toBe(false)
  })

  it("needs a single session — a week of short runs is not a long one", () => {
    const shortRuns = [
      session({ distanceKm: 4, date: daysAgo(2) }),
      session({ distanceKm: 4, date: daysAgo(1) }),
      session({ distanceKm: 4 }),
    ]
    expect(meetsEnduranceCriteria(distance(10), shortRuns, TODAY)).toBe(false)
  })

  it("ignores a session with no distance logged", () => {
    expect(meetsEnduranceCriteria(distance(5), [session({ distanceKm: null })], TODAY)).toBe(false)
  })

  it("counts a jog but not a walk", () => {
    expect(meetsEnduranceCriteria(distance(5), [session({ activitySlug: "jog" })], TODAY)).toBe(true)
    expect(
      meetsEnduranceCriteria(distance(5), [session({ activitySlug: "walk-brisk" })], TODAY)
    ).toBe(false)
  })
})

describe("pace criteria", () => {
  it("clears exactly on the limit", () => {
    // 5 km in 30 min = 6:00 /km exactly.
    expect(
      meetsEnduranceCriteria(pace(5, 6), [session({ distanceKm: 5, durationMin: 30 })], TODAY)
    ).toBe(true)
  })

  it("rejects a pace just over the limit", () => {
    expect(
      meetsEnduranceCriteria(pace(5, 6), [session({ distanceKm: 5, durationMin: 30.5 })], TODAY)
    ).toBe(false)
  })

  it("rejects a fast run that is too short to count", () => {
    // 3 km at 4:00/km is quick, but the criterion asks for five.
    expect(
      meetsEnduranceCriteria(pace(5, 6), [session({ distanceKm: 3, durationMin: 12 })], TODAY)
    ).toBe(false)
  })

  it("cannot be met without a distance to divide by", () => {
    expect(
      meetsEnduranceCriteria(pace(5, 6), [session({ distanceKm: null, durationMin: 20 })], TODAY)
    ).toBe(false)
  })

  it("computes pace, and returns null when it can't", () => {
    expect(pacePerKm(session({ distanceKm: 10, durationMin: 55 }))).toBeCloseTo(5.5, 6)
    expect(pacePerKm(session({ distanceKm: null }))).toBeNull()
    expect(pacePerKm(session({ distanceKm: 0 }))).toBeNull()
  })

  it("takes the best session, not the latest", () => {
    const sessions = [
      session({ distanceKm: 5, durationMin: 25 }), // 5:00 /km
      session({ distanceKm: 5, durationMin: 40 }), // 8:00 /km
    ]
    expect(meetsEnduranceCriteria(pace(5, 5.5), sessions, TODAY)).toBe(true)
  })
})

describe("frequency criteria", () => {
  it("fires on the Nth session inside the window", () => {
    const three = [session({ date: daysAgo(2) }), session({ date: daysAgo(1) }), session()]
    expect(meetsEnduranceCriteria(frequency(3, 7), three, TODAY)).toBe(true)
    expect(meetsEnduranceCriteria(frequency(4, 7), three, TODAY)).toBe(false)
  })

  it("counts the window inclusively from today", () => {
    // A 7-day window covers today and the six days before it.
    const edge = [session({ date: daysAgo(6) }), session()]
    expect(meetsEnduranceCriteria(frequency(2, 7), edge, TODAY)).toBe(true)
  })

  it("drops a session that has aged out of the window", () => {
    const stale = [session({ date: daysAgo(7) }), session()]
    expect(meetsEnduranceCriteria(frequency(2, 7), stale, TODAY)).toBe(false)
  })

  it("ignores sessions dated in the future", () => {
    const d = new Date(`${TODAY}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    const future = [session({ date: d.toISOString().slice(0, 10) }), session()]
    expect(meetsEnduranceCriteria(frequency(2, 7), future, TODAY)).toBe(false)
  })

  it("only counts qualifying activities", () => {
    const mixed = [session({ activitySlug: "walk-brisk" }), session({ activitySlug: "jump-rope" })]
    expect(meetsEnduranceCriteria(frequency(2, 7), mixed, TODAY)).toBe(false)
  })
})

describe("the two criteria languages stay apart", () => {
  it("meetsCriteria never clears an endurance node from sets", () => {
    expect(meetsCriteria(distance(1), [{ reps: 100, seconds: null }])).toBe(false)
    expect(meetsCriteria(frequency(1, 7), [{ reps: null, seconds: 9999 }])).toBe(false)
  })

  it("meetsEnduranceCriteria never clears a sets node from sessions", () => {
    const reps: UnlockCriteria = { kind: "reps", sets: 3, reps: 8 }
    expect(meetsEnduranceCriteria(reps, [session()], TODAY)).toBe(false)
  })

  it("classifies every kind", () => {
    expect(isEnduranceCriteria(distance(1))).toBe(true)
    expect(isEnduranceCriteria(pace(5, 6))).toBe(true)
    expect(isEnduranceCriteria(frequency(2, 7))).toBe(true)
    expect(isEnduranceCriteria({ kind: "reps", sets: 3, reps: 8 })).toBe(false)
    expect(isEnduranceCriteria({ kind: "hold", sets: 3, seconds: 30 })).toBe(false)
  })
})

describe("the seeded content", () => {
  const nodes = allEnduranceNodes()

  it("ships 6 paths and 37 nodes", () => {
    expect(ENDURANCE_PATHS.length).toBe(6)
    expect(nodes.length).toBe(37)
  })

  it("gives every node a unique slug and a described criterion", () => {
    const slugs = nodes.map((n) => n.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const node of nodes) {
      expect(node.criteria.description).toBeTruthy()
      expect(node.demoNotes.length).toBeGreaterThan(10)
      expect(isEnduranceCriteria(node.criteria)).toBe(true)
    }
  })

  it("keeps every ladder strictly harder as it goes", () => {
    for (const path of ENDURANCE_PATHS) {
      const difficulty = path.nodes.map((n) => {
        const c = n.criteria
        if (c.kind === "distance") return c.km
        // Faster pace is harder, so invert it to get an ascending series.
        if (c.kind === "pace") return -c.maxPacePerKm
        if (c.kind === "frequency") return c.count / c.windowDays
        return 0
      })
      const ascending = [...difficulty].sort((a, b) => a - b)
      expect(difficulty, `${path.slug} is not ordered`).toEqual(ascending)
      expect(new Set(difficulty).size, `${path.slug} has a repeated rung`).toBe(
        difficulty.length
      )
    }
  })

  it("only lets each discipline's own activities clear its nodes", () => {
    for (const path of ENDURANCE_PATHS) {
      const expected = QUALIFYING_ACTIVITIES[path.disciplineSlug]
      for (const node of path.nodes) {
        expect((node.criteria as { activities: string[] }).activities).toEqual(expected)
      }
    }
  })

  it("numbers positions from one, in order, within each path", () => {
    for (const path of ENDURANCE_PATHS) {
      const positions = nodes
        .filter((n) => n.pathSlug === path.slug)
        .map((n) => n.position)
      expect(positions).toEqual(path.nodes.map((_, i) => i + 1))
    }
  })

  it("converts cycling speed into pace correctly", () => {
    const twenty = ENDURANCE_PATHS.find((p) => p.slug === "cycling-speed")!.nodes[0]
    // 20 km/h is 3:00 per kilometre.
    expect((twenty.criteria as { maxPacePerKm: number }).maxPacePerKm).toBeCloseTo(3, 6)
    // A 20 km ride in 60 minutes is exactly 20 km/h and must clear it.
    expect(
      meetsEnduranceCriteria(
        twenty.criteria,
        [session({ activitySlug: "cycling-moderate", distanceKm: 20, durationMin: 60 })],
        TODAY
      )
    ).toBe(true)
  })
})
