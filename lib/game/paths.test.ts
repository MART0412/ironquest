import { describe, expect, it } from "vitest"

import {
  buildPathTracks,
  cascadeCandidates,
  PATH_STAT_WEIGHTS,
  validatePathNodes,
  type PathInput,
} from "./paths"
import { computePathStats, STAT_KEYS } from "./stats"

const ex = (id: string, name = id) => ({
  id,
  slug: id,
  name,
  unlock_criteria: { kind: "reps" as const, sets: 3, reps: 8 },
  demo_notes: null,
})

/** Two paths sharing their first node — the dead-hang pattern. */
function twoSharedPaths(): PathInput[] {
  return [
    {
      slug: "front-lever",
      name: "Front Lever Path",
      signatureExerciseId: "fl",
      nodes: [
        { position: 1, exercise: ex("hang", "Dead Hang") },
        { position: 2, exercise: ex("tuck") },
        { position: 3, exercise: ex("fl", "Front Lever") },
      ],
    },
    {
      slug: "back-lever",
      name: "Back Lever Path",
      signatureExerciseId: "bl",
      nodes: [
        { position: 1, exercise: ex("hang", "Dead Hang") },
        { position: 2, exercise: ex("german") },
        { position: 3, exercise: ex("bl", "Back Lever") },
      ],
    },
  ]
}

const unlock = (id: string) => ({ exercise_id: id, unlocked_at: "2026-07-28T00:00:00Z" })

describe("buildPathTracks — left→right progression", () => {
  it("orders nodes by position with strictly increasing x", () => {
    const [fl] = buildPathTracks(twoSharedPaths(), [])
    expect(fl.nodes.map((n) => n.slug)).toEqual(["hang", "tuck", "fl"])
    for (let i = 1; i < fl.nodes.length; i++) {
      expect(fl.nodes[i].position).toBeGreaterThan(fl.nodes[i - 1].position)
      expect(fl.nodes[i].x).toBeGreaterThan(fl.nodes[i - 1].x)
    }
  })

  it("sorts unsorted input rather than trusting query order", () => {
    const paths = twoSharedPaths()
    paths[0].nodes = [paths[0].nodes[2], paths[0].nodes[0], paths[0].nodes[1]]
    const [fl] = buildPathTracks(paths, [])
    expect(fl.nodes.map((n) => n.slug)).toEqual(["hang", "tuck", "fl"])
  })

  it("marks the signature skill as the capstone, last and largest", () => {
    const [fl] = buildPathTracks(twoSharedPaths(), [])
    const capstones = fl.nodes.filter((n) => n.isCapstone)
    expect(capstones).toHaveLength(1)
    expect(capstones[0].slug).toBe("fl")
    expect(fl.nodes[fl.nodes.length - 1].isCapstone).toBe(true)
    expect(capstones[0].radius).toBeGreaterThan(fl.nodes[0].radius)
    expect(capstones[0].x).toBe(Math.max(...fl.nodes.map((n) => n.x)))
  })

  it("counts how many paths share a node", () => {
    const [fl, bl] = buildPathTracks(twoSharedPaths(), [])
    expect(fl.nodes.find((n) => n.slug === "hang")!.pathCount).toBe(2)
    expect(bl.nodes.find((n) => n.slug === "hang")!.pathCount).toBe(2)
    expect(fl.nodes.find((n) => n.slug === "tuck")!.pathCount).toBe(1)
  })

  it("lights a shared node's unlock in EVERY containing path", () => {
    const tracks = buildPathTracks(twoSharedPaths(), [unlock("hang")])
    for (const track of tracks) {
      const shared = track.nodes.find((n) => n.slug === "hang")!
      expect(shared.state).toBe("unlocked")
      expect(shared.unlockedAt).toBe("2026-07-28T00:00:00Z")
      // and each path's own second node becomes the frontier
      expect(track.nodes[1].state).toBe("next")
    }
  })

  it("advances the frontier independently per path", () => {
    const tracks = buildPathTracks(twoSharedPaths(), [unlock("hang"), unlock("german")])
    const fl = tracks.find((t) => t.key === "front-lever")!
    const bl = tracks.find((t) => t.key === "back-lever")!
    expect(fl.nodes.map((n) => n.state)).toEqual(["unlocked", "next", "locked"])
    expect(bl.nodes.map((n) => n.state)).toEqual(["unlocked", "unlocked", "next"])
  })

  it("reports progress per path", () => {
    const tracks = buildPathTracks(twoSharedPaths(), [unlock("hang")])
    expect(tracks[0].unlockedCount).toBe(1)
    expect(tracks[0].total).toBe(3)
    expect(tracks[0].progress).toBeCloseTo(1 / 3)
  })

  it("connects consecutive positions only", () => {
    const [fl] = buildPathTracks(twoSharedPaths(), [])
    expect(fl.edges).toEqual([
      { from: "hang", to: "tuck" },
      { from: "tuck", to: "fl" },
    ])
  })

  it("renders a repeated exercise once, and throws when strict", () => {
    const paths = twoSharedPaths()
    paths[0].nodes.push({ position: 4, exercise: ex("hang", "Dead Hang") })
    const [fl] = buildPathTracks(paths, [], { strict: false })
    expect(fl.nodes.filter((n) => n.slug === "hang")).toHaveLength(1)
    expect(validatePathNodes(fl.nodes).ok).toBe(true)
    expect(() => buildPathTracks(paths, [], { strict: true })).toThrow(
      /uniqueness invariant/
    )
  })

  it("every built path satisfies the ordering invariant", () => {
    for (const track of buildPathTracks(twoSharedPaths(), [])) {
      expect(validatePathNodes(track.nodes).ok).toBe(true)
    }
  })
})

describe("cascadeCandidates — what a fast-track clear would credit", () => {
  it("credits every still-locked node before the target", () => {
    const tracks = buildPathTracks(twoSharedPaths(), [])
    expect(cascadeCandidates(tracks, "fl").sort()).toEqual(["hang", "tuck"])
  })

  it("skips nodes already unlocked", () => {
    const tracks = buildPathTracks(twoSharedPaths(), [unlock("hang")])
    expect(cascadeCandidates(tracks, "fl")).toEqual(["tuck"])
  })

  it("counts a node shared by two paths only once", () => {
    // Making both capstones reachable would double-count "hang" if the union
    // weren't deduped; here we check the shared node from one target's view.
    const tracks = buildPathTracks(twoSharedPaths(), [])
    const ids = cascadeCandidates(tracks, "hang")
    expect(ids).toEqual([])
  })

  it("never reaches across into a path that lacks the target", () => {
    const tracks = buildPathTracks(twoSharedPaths(), [])
    // Back Lever's own predecessors only — no Front Lever nodes.
    expect(cascadeCandidates(tracks, "bl").sort()).toEqual(["german", "hang"])
  })

  it("is empty for the first node and for an unknown id", () => {
    const tracks = buildPathTracks(twoSharedPaths(), [])
    expect(cascadeCandidates(tracks, "nope")).toEqual([])
  })
})

describe("validatePathNodes", () => {
  it("passes a clean ascending path", () => {
    expect(
      validatePathNodes([
        { id: "a", position: 1 },
        { id: "b", position: 2 },
      ]).ok
    ).toBe(true)
  })

  it("flags duplicate positions", () => {
    const v = validatePathNodes([
      { id: "a", position: 1 },
      { id: "b", position: 1 },
    ])
    expect(v.ok).toBe(false)
    expect(v.duplicatePositions).toEqual([1])
  })

  it("flags a duplicated exercise", () => {
    const v = validatePathNodes([
      { id: "a", position: 1 },
      { id: "a", position: 2 },
    ])
    expect(v.ok).toBe(false)
    expect(v.duplicateIds).toEqual(["a"])
  })

  it("flags out-of-order positions", () => {
    expect(
      validatePathNodes([
        { id: "a", position: 3 },
        { id: "b", position: 2 },
      ]).outOfOrder
    ).toBe(true)
  })
})

describe("PATH_STAT_WEIGHTS", () => {
  const SEEDED = [
    "planche",
    "front-lever",
    "back-lever",
    "muscle-up",
    "one-arm-pull-up",
    "handstand",
    "one-arm-push-up",
    "pistol-squat",
    "l-sit",
  ]

  it("covers every seeded path", () => {
    for (const slug of SEEDED) {
      expect(PATH_STAT_WEIGHTS[slug], `missing weights for ${slug}`).toBeDefined()
    }
    expect(Object.keys(PATH_STAT_WEIGHTS).sort()).toEqual([...SEEDED].sort())
  })

  it("gives every stat at least one contributing path", () => {
    for (const stat of STAT_KEYS) {
      const contributors = Object.values(PATH_STAT_WEIGHTS).filter(
        (w) => (w[stat] ?? 0) > 0
      )
      expect(contributors.length, `no path feeds ${stat}`).toBeGreaterThan(0)
    }
  })

  it("uses weights that sum to 1 per path", () => {
    for (const [slug, weights] of Object.entries(PATH_STAT_WEIGHTS)) {
      const sum = Object.values(weights).reduce((s, w) => s + (w ?? 0), 0)
      expect(sum, `${slug} weights should sum to 1`).toBeCloseTo(1)
    }
  })
})

describe("computePathStats", () => {
  const allPaths = (v: number) =>
    Object.fromEntries(Object.keys(PATH_STAT_WEIGHTS).map((k) => [k, v]))

  it("is all-zero with no progress", () => {
    const stats = computePathStats({})
    expect(STAT_KEYS.every((s) => stats[s] === 0)).toBe(true)
  })

  it("reaches 1.0 on every stat when all paths are complete", () => {
    const stats = computePathStats(allPaths(1))
    for (const stat of STAT_KEYS) expect(stats[stat]).toBeCloseTo(1)
  })

  it("maps a single path onto its own stats only", () => {
    const stats = computePathStats({ "pistol-squat": 1 })
    expect(stats.LEGS).toBeCloseTo(1)
    expect(stats.STR).toBe(0)
    expect(stats.PULL).toBe(0)
    expect(stats.BALANCE).toBe(0)
  })

  it("weights a shared stat by its contributing paths", () => {
    // STR is fed by planche 0.7, muscle-up 0.3, handstand 0.3, one-arm-push-up 1
    const stats = computePathStats({ "one-arm-push-up": 1 })
    const strDivisor = 0.7 + 0.3 + 0.3 + 1
    expect(stats.STR).toBeCloseTo(1 / strDivisor)
  })

  it("clamps out-of-range progress instead of producing >1 or NaN", () => {
    const stats = computePathStats({ "pistol-squat": 5, "l-sit": -2 })
    expect(stats.LEGS).toBeCloseTo(1)
    expect(stats.CORE).toBe(0)
    expect(STAT_KEYS.every((s) => !Number.isNaN(stats[s]))).toBe(true)
  })

  it("ignores unknown path slugs", () => {
    const stats = computePathStats({ "not-a-path": 1 })
    expect(STAT_KEYS.every((s) => stats[s] === 0)).toBe(true)
  })
})
