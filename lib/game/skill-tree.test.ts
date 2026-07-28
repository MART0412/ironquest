import { describe, expect, it } from "vitest"

import { computeStats, STAT_CONFIG } from "./stats"
import {
  buildBranchTracks,
  nodeState,
  validateBranchNodes,
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

const track = (exercises: ExerciseNode[], unlocks: { exercise_id: string; unlocked_at: string }[] = []) =>
  buildBranchTracks(exercises, unlocks).find((t) => t.key === "push")!

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

describe("buildBranchTracks — left→right progression", () => {
  it("orders nodes strictly ascending by tier with strictly increasing x", () => {
    const t = track(pushChain())
    expect(t.nodes.map((n) => n.tier)).toEqual([1, 2, 3])
    for (let i = 1; i < t.nodes.length; i++) {
      expect(t.nodes[i].tier).toBeGreaterThan(t.nodes[i - 1].tier)
      expect(t.nodes[i].x).toBeGreaterThan(t.nodes[i - 1].x)
    }
  })

  it("puts the easiest node at the far left and the hardest at the far right", () => {
    const t = track(pushChain())
    const xs = t.nodes.map((n) => n.x)
    expect(t.nodes[0].tier).toBe(1)
    expect(t.nodes[0].x).toBe(Math.min(...xs))
    expect(t.nodes[t.nodes.length - 1].tier).toBe(3)
    expect(t.nodes[t.nodes.length - 1].x).toBe(Math.max(...xs))
  })

  it("sorts unsorted input rather than trusting query order", () => {
    const shuffled = [pushChain()[2], pushChain()[0], pushChain()[1]]
    const t = track(shuffled)
    expect(t.nodes.map((n) => n.slug)).toEqual(["wall", "incline", "pushup"])
  })

  it("lays every branch on a single row (vertical stacking is per-branch)", () => {
    const t = track(pushChain())
    expect(new Set(t.nodes.map((n) => n.y)).size).toBe(1)
  })

  it("carries state, prerequisite and unlock date", () => {
    const t = track(pushChain(), [{ exercise_id: "p1", unlocked_at: "2026-07-13T00:00:00Z" }])
    expect(t.nodes[0].state).toBe("unlocked")
    expect(t.nodes[0].unlockedAt).toBe("2026-07-13T00:00:00Z")
    expect(t.nodes[1].state).toBe("next")
    expect(t.nodes[1].prerequisiteName).toBe("Wall Push-Up")
    expect(t.unlockedCount).toBe(1)
    expect(t.total).toBe(3)
  })

  it("connects consecutive tiers only", () => {
    const t = track(pushChain())
    expect(t.edges).toEqual([
      { from: "p1", to: "p2", branch: "push" },
      { from: "p2", to: "p3", branch: "push" },
    ])
  })

  it("renders each exercise exactly once even if the input repeats it", () => {
    const dupInput = [...pushChain(), pushChain()[0]] // wall push-up twice
    const t = buildBranchTracks(dupInput, [], { strict: false }).find(
      (x) => x.key === "push"
    )!
    expect(t.nodes.filter((n) => n.slug === "wall").length).toBe(1)
    expect(t.nodes.length).toBe(3)
    expect(t.nodes.map((n) => n.tier)).toEqual([1, 2, 3])
    expect(validateBranchNodes(t.nodes).ok).toBe(true)
  })

  it("fails loudly on duplicated seed data when strict", () => {
    const dupInput = [...pushChain(), pushChain()[0]]
    expect(() => buildBranchTracks(dupInput, [], { strict: true })).toThrow(
      /uniqueness invariant/
    )
  })

  it("does not throw on merely unsorted input (sorting is not a fault)", () => {
    const shuffled = [pushChain()[2], pushChain()[0], pushChain()[1]]
    expect(() => buildBranchTracks(shuffled, [], { strict: true })).not.toThrow()
  })

  it("builds one track per branch, in stacking order", () => {
    const tracks = buildBranchTracks(pushChain(), [])
    expect(tracks.map((t) => t.key)).toEqual(["push", "pull", "core", "legs", "static"])
  })

  it("every rendered branch satisfies the ordering invariant", () => {
    for (const t of buildBranchTracks(pushChain(), [])) {
      expect(validateBranchNodes(t.nodes).ok).toBe(true)
    }
  })
})

describe("validateBranchNodes", () => {
  it("passes a clean strictly-ascending branch", () => {
    expect(
      validateBranchNodes([
        { id: "a", tier: 1 },
        { id: "b", tier: 2 },
      ])
    ).toMatchObject({ ok: true, duplicateIds: [], duplicateTiers: [], outOfOrder: false })
  })

  it("flags a duplicated node id", () => {
    const v = validateBranchNodes([
      { id: "a", tier: 1 },
      { id: "a", tier: 2 },
    ])
    expect(v.ok).toBe(false)
    expect(v.duplicateIds).toEqual(["a"])
  })

  it("flags a duplicated tier", () => {
    const v = validateBranchNodes([
      { id: "a", tier: 1 },
      { id: "b", tier: 1 },
    ])
    expect(v.ok).toBe(false)
    expect(v.duplicateTiers).toEqual([1])
  })

  it("flags out-of-order tiers", () => {
    const v = validateBranchNodes([
      { id: "a", tier: 3 },
      { id: "b", tier: 2 },
    ])
    expect(v.ok).toBe(false)
    expect(v.outOfOrder).toBe(true)
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
    expect(high).toBeCloseTo(0.5)
    expect(low).toBeCloseTo(1 / 6)
  })

  it("honors a custom weight function", () => {
    const flat = computeStats({ ...empty, push: [1] }, maxTiers, {
      tierWeight: () => 1,
    }).STR
    expect(flat).toBeCloseTo(1 / 3)
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
