// Pure skill-unlock + PR rules (spec §2.1, §3.1). Tested specification of the
// logic inside complete_workout's unlock/PR blocks (the sole writer of these
// awards, rule 6). Keep in lockstep with the SQL — same pattern as
// lib/game/streak.ts and lib/game/nutrition.ts.

export const SKILL_UNLOCK_XP = { xp: 200, points: 25 } as const
export const PR_XP = { xp: 75, points: 10 } as const

export type UnlockCriteria =
  | { kind: "reps"; sets: number; reps: number; description?: string }
  | { kind: "hold"; sets: number; seconds: number; description?: string }

/** A set as stored in workout_sets: one of reps/seconds is populated. */
export type LoggedSet = { reps: number | null; seconds: number | null }

/**
 * Whether this workout's sets for an exercise satisfy its unlock criteria.
 * "3×8" = at least 3 sets each with reps ≥ 8 (exact threshold counts; extra
 * sets are fine). Rep criteria ignore hold-only sets and vice versa.
 */
export function meetsCriteria(
  criteria: UnlockCriteria,
  sets: LoggedSet[]
): boolean {
  if (criteria.kind === "reps") {
    const qualifying = sets.filter((s) => (s.reps ?? 0) >= criteria.reps).length
    return qualifying >= criteria.sets
  }
  const qualifying = sets.filter((s) => (s.seconds ?? 0) >= criteria.seconds).length
  return qualifying >= criteria.sets
}

/**
 * Whether a node can be unlocked right now.
 * `prereqUnlocked === null` means the node has no prerequisite (tier 1).
 */
export function isUnlockable(ctx: {
  criteriaMet: boolean
  alreadyUnlocked: boolean
  prereqUnlocked: boolean | null
}): boolean {
  if (ctx.alreadyUnlocked) return false
  if (!ctx.criteriaMet) return false
  return ctx.prereqUnlocked === null ? true : ctx.prereqUnlocked
}

export type BestPerformance = { reps: number | null; seconds: number | null }

/**
 * A personal record is strictly greater than the prior best for the SAME
 * metric, and only against an existing baseline — a first-ever log establishes
 * the baseline (no record to break yet), an equal effort is not a record.
 * Reps take precedence when both metrics improve (seed exercises are single-
 * metric, so this only matters for mixed custom logging).
 */
export function detectPR(
  current: BestPerformance,
  historical: BestPerformance
): { metric: "reps" | "seconds"; value: number } | null {
  if (
    current.reps != null &&
    historical.reps != null &&
    current.reps > historical.reps
  ) {
    return { metric: "reps", value: current.reps }
  }
  if (
    current.seconds != null &&
    historical.seconds != null &&
    current.seconds > historical.seconds
  ) {
    return { metric: "seconds", value: current.seconds }
  }
  return null
}
