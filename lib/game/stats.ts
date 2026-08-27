// RPG stat radar computation (spec §3.1, §3.2). The five stats are now driven
// by GOAL-PATH progress rather than muscle-group branch tiers: each path
// contributes to one or two stats with tunable weights (PATH_STAT_WEIGHTS in
// lib/game/paths.ts), so chasing the Planche lifts STR/CORE while chasing the
// Pistol lifts LEGS.

import { PATH_STAT_WEIGHTS } from "./paths"
import type { StatKey } from "./skill-tree"

export const STAT_KEYS: StatKey[] = ["STR", "PULL", "CORE", "LEGS", "BALANCE"]

export type DisciplineRadar = {
  /** Axes in draw order, starting at the top and going clockwise. */
  axes: StatKey[]
  /** How much each path feeds each axis. */
  weights: Record<string, Partial<Record<StatKey, number>>>
}

/**
 * A radar per discipline. Calisthenics keeps its pentagon; the endurance
 * disciplines get a triangle whose axes are the three things that actually
 * describe a runner or a rider — how far, how fast, how often.
 */
export const DISCIPLINE_RADARS: Record<string, DisciplineRadar> = {
  calisthenics: {
    axes: STAT_KEYS,
    weights: PATH_STAT_WEIGHTS,
  },
  running: {
    axes: ["DISTANCE", "PACE", "CONSISTENCY"],
    weights: {
      "running-distance": { DISTANCE: 1 },
      "running-pace": { PACE: 1 },
      "running-consistency": { CONSISTENCY: 1 },
    },
  },
  cycling: {
    axes: ["DISTANCE", "SPEED", "CONSISTENCY"],
    weights: {
      "cycling-distance": { DISTANCE: 1 },
      "cycling-speed": { SPEED: 1 },
      "cycling-consistency": { CONSISTENCY: 1 },
    },
  },
}

/** The radar for a discipline, or null when it has no tree to chart. */
export function radarFor(disciplineSlug: string): DisciplineRadar | null {
  return DISCIPLINE_RADARS[disciplineSlug] ?? null
}

/**
 * Weighted average of path progress per stat:
 *   stat = Σ(progress_path × weight_path,stat) / Σ(weight_path,stat)
 *
 * A stat with no contributing paths is 0 (never NaN). Progress values are
 * clamped to 0..1, so the result is always a valid radar magnitude.
 */
export function computePathStats(
  progressByPath: Record<string, number>,
  weights: Record<string, Partial<Record<StatKey, number>>> = PATH_STAT_WEIGHTS,
  axes: StatKey[] = STAT_KEYS
): Record<StatKey, number> {
  const totals = {} as Record<StatKey, number>
  const divisors = {} as Record<StatKey, number>
  for (const stat of axes) {
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
      // Ignore a weight for an axis this radar doesn't draw.
      if (!(stat in totals)) continue
      totals[stat] += progress * weight
      divisors[stat] += weight
    }
  }

  const result = {} as Record<StatKey, number>
  for (const stat of axes) {
    result[stat] = divisors[stat] > 0 ? totals[stat] / divisors[stat] : 0
  }
  return result
}
