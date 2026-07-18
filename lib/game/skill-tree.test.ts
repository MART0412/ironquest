import { describe, expect, it } from "vitest"

import { computeStats, STAT_CONFIG } from "./stats"
import {
  buildTree,
  nodeState,
  type BranchKey,
  type ExerciseNode,
} from "./skill-tree"

// Minimal 3-tier push branch fixture.
function pushChain(): ExerciseNode[] {
  return [
    { id: "p1", slug: "wall", name: "Wall Push-Up", branch: "push", tier: 1, unlock_criteria: null, demo_notes: null },
    { id: "p2", slug: "incline", name: "Incline Push-Up", branch: "push", tier: 2, unlock_criteria: null, demo_notes: null },
    { id: "p3", slug: "pushup", name: "Push-Up", branch: "push", tier: 3, unlock_criteria: null, demo_notes: null },
  ]
}

describe("nodeState (frontier / gating)", () => {
  const chain = pushChain().map((n) => ({ id: n.id, tier: n.tier }))

  it("tier 1 is 'next' when nothing is unlocked", () => {
    const set = new Set<string>()
    expect(nodeState(chain[0], chain, set)).toBe("next")
    expect(nodeState(chain[1], chain, set)).toBe("locked")
    expect(nodeState(chain[2], chain, set)).toBe("locked")
  })

  it("frontier advances as tiers unlock", () => {
    const set = new Set(["p1"])
    expect(nodeState(chain[0], chain, set)).toBe("unlocked")
    expect(nodeState(chain[1], chain, set)).toBe("next")
    expect(nodeState(chain[2], chain, set)).toBe("locked")
  })

  it("all unlocked → no 'next'", () => {
    const set = new Set(["p1", "p2", "p3"])
    expect(chain.map((n) => nodeState(n, chain, set))).toEqual([
      "unlocked",
      "unlocked",
      "unlocked",
    ])
  })
})

describe("buildTree", () => {
  it("positions nodes by branch column and tier row, with tier→tier edges", () => {
    const { nodes, edges } = buildTree(pushChain(), [
      { exercise_id: "p1", unlocked_at: "2026-07-13T00:00:00Z" },
    ])

    const p1 = nodes.find((n) => n.id === "p1")!
    const p2 = nodes.find((n) => n.id === "p2")!
    expect(p1.state).toBe("unlocked")
    expect(p1.unlockedAt).toBe("2026-07-13T00:00:00Z")
    expect(p2.state).toBe("next")
    expect(p2.prerequisiteName).toBe("Wall Push-Up")
    expect(p2.y).toBeGreaterThan(p1.y) // deeper tier sits lower
    expect(p1.x).toBe(p2.x) // same branch column

    expect(edges).toEqual([
      { from: "p1", to: "p2", branch: "push" },
      { from: "p2", to: "p3", branch: "push" },
    ])
  })
})

describe("computeStats (tunable weights)", () => {
  const empty = { push: [], pull: [], core: [], legs: [], static: [] } as Record<BranchKey, number[]>
  const maxTiers = { push: 3, pull: 3, core: 3, legs: 3, static: 3 } as Record<BranchKey, number>

  it("is all-zero with no unlocks", () => {
    const stats = computeStats(empty, maxTiers)
    expect(Object.values(stats).every((v) => v === 0)).toBe(true)
  })

  it("reaches 1.0 for a fully unlocked branch", () => {
    const stats = computeStats({ ...empty, push: [1, 2, 3] }, maxTiers)
    expect(stats.STR).toBe(1)
    expect(stats.PULL).toBe(0)
  })

  it("weights deeper tiers more (tier 3 alone > tier 1 alone)", () => {
    const low = computeStats({ ...empty, push: [1] }, maxTiers).STR
    const high = computeStats({ ...empty, push: [3] }, maxTiers).STR
    expect(high).toBeGreaterThan(low)
    // tier weights 1+2+3 = 6; tier 3 alone = 3/6 = 0.5
    expect(high).toBeCloseTo(0.5)
    expect(low).toBeCloseTo(1 / 6)
  })

  it("honors a custom weight function", () => {
    const flat = computeStats({ ...empty, push: [1] }, maxTiers, {
      tierWeight: () => 1,
    }).STR
    expect(flat).toBeCloseTo(1 / 3) // 1 of 3 equal-weight tiers
  })

  it("clamps and handles empty branches without NaN", () => {
    const stats = computeStats({ ...empty, push: [1, 2, 3] }, { ...maxTiers, pull: 0 })
    expect(stats.PULL).toBe(0)
    expect(Number.isNaN(stats.PULL)).toBe(false)
  })

  it("default config matches STAT_CONFIG", () => {
    expect(STAT_CONFIG.tierWeight(4)).toBe(4)
  })
})
