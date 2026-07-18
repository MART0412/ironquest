// RPG stat radar computation (spec §3.1, §3.2). Five stats driven by how far
// the user has climbed each branch. Weights are isolated here so they're tunable
// without touching the renderer or query code.

import { BRANCH_CONFIG, type BranchKey, type StatKey } from "./skill-tree"

export const STAT_KEYS: StatKey[] = ["STR", "PULL", "CORE", "LEGS", "BALANCE"]

export type StatConfig = {
  /** Weight earned for unlocking the node at a given tier (deeper = worth more). */
  tierWeight: (tier: number) => number
}

export const STAT_CONFIG: StatConfig = {
  // Linear: tier 1 worth 1, tier 5 worth 5. Deeper progressions dominate the
  // stat, so a lit branch tip reads as real mastery. Swap this fn to retune.
  tierWeight: (tier) => tier,
}

/** Sum of tierWeight(1..maxTier) — the fully-unlocked branch total. */
function branchMaxScore(maxTier: number, config: StatConfig): number {
  let total = 0
  for (let t = 1; t <= maxTier; t++) total += config.tierWeight(t)
  return total
}

/**
 * Per-branch 0..1 progress → mapped onto the five stats. Each stat is the
 * weighted unlocked score over the branch's max possible score.
 */
export function computeStats(
  unlockedTiersByBranch: Record<BranchKey, number[]>,
  maxTierByBranch: Record<BranchKey, number>,
  config: StatConfig = STAT_CONFIG
): Record<StatKey, number> {
  const result = {} as Record<StatKey, number>
  for (const stat of STAT_KEYS) result[stat] = 0

  for (const branch of Object.keys(BRANCH_CONFIG) as BranchKey[]) {
    const stat = BRANCH_CONFIG[branch].stat
    const maxTier = maxTierByBranch[branch] ?? 0
    const max = branchMaxScore(maxTier, config)
    if (max === 0) {
      result[stat] = 0
      continue
    }
    const earned = (unlockedTiersByBranch[branch] ?? []).reduce(
      (sum, tier) => sum + config.tierWeight(tier),
      0
    )
    result[stat] = Math.min(1, earned / max)
  }

  return result
}
