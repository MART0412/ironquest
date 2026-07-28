// RPG stat radar computation (spec §3.1, §3.2). The five stats are now driven
// by GOAL-PATH progress rather than muscle-group branch tiers: each path
// contributes to one or two stats with tunable weights (PATH_STAT_WEIGHTS in
// lib/game/paths.ts), so chasing the Planche lifts STR/CORE while chasing the
// Pistol lifts LEGS.

import { PATH_STAT_WEIGHTS } from "./paths"
import type { StatKey } from "./skill-tree"

export const STAT_KEYS: StatKey[] = ["STR", "PULL", "CORE", "LEGS", "BALANCE"]

/**
 * Weighted average of path progress per stat:
 *   stat = Σ(progress_path × weight_path,stat) / Σ(weight_path,stat)
 *
 * A stat with no contributing paths is 0 (never NaN). Progress values are
 * clamped to 0..1, so the result is always a valid radar magnitude.
 */
export function computePathStats(
  progressByPath: Record<string, number>,
  weights: Record<string, Partial<Record<StatKey, number>>> = PATH_STAT_WEIGHTS
): Record<StatKey, number> {
  const totals = {} as Record<StatKey, number>
  const divisors = {} as Record<StatKey, number>
  for (const stat of STAT_KEYS) {
    totals[stat] = 0
    divisors[stat] = 0
  }

  for (const [pathSlug, statWeights] of Object.entries(weights)) {
    const raw = progressByPath[pathSlug] ?? 0
    const progress = Math.min(1, Math.max(0, raw))
    for (const [stat, weight] of Object.entries(statWeights) as [
      StatKey,
      number,
    ][]) {
      if (!weight) continue
      totals[stat] += progress * weight
      divisors[stat] += weight
    }
  }

  const result = {} as Record<StatKey, number>
  for (const stat of STAT_KEYS) {
    result[stat] = divisors[stat] > 0 ? totals[stat] / divisors[stat] : 0
  }
  return result
}
