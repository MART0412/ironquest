// Challenge-based unlocks (Duolingo-style). Unlocks are no longer silent
// side-effects: when your logged numbers suggest you're ready for the next
// locked skill, the app OFFERS a challenge, and you unlock it by actually
// performing and logging that skill's criteria — never by self-declaration.
//
// Mirrors the SQL in complete_workout (offer detection) and attempt_challenge
// (resolution + fast-track cascade). Keep both in lockstep.

import { meetsCriteria, type LoggedSet, type UnlockCriteria } from "@/lib/game/skills"

export type ChallengeStatus = "ready" | "declined" | "failed" | "completed"

/** An open challenge still shows its badge; a completed one is just unlocked. */
export const OPEN_CHALLENGE_STATUSES: ChallengeStatus[] = [
  "ready",
  "declined",
  "failed",
]

/**
 * Fraction of a normal unlock award granted for nodes skipped by a fast-track
 * challenge. The skipped skills are credited (you demonstrably own them, since
 * you just performed something harder) but not at full price.
 */
export const CASCADE_XP_RATE = 0.25

/**
 * Readiness signal: do the numbers you just logged on one exercise satisfy a
 * *different*, harder node's criteria? This compares numbers, not movements —
 * hitting 3×8 pull-ups satisfies "3×6" numerically, which is why it's only an
 * invitation to attempt the harder skill, never evidence of it.
 *
 * A criteria-kind mismatch (reps logged vs a hold target) can never qualify,
 * because the unmatched metric is null on those sets.
 */
export function meetsReadiness(
  loggedSets: LoggedSet[],
  targetCriteria: UnlockCriteria
): boolean {
  return meetsCriteria(targetCriteria, loggedSets)
}

/**
 * Whether to surface a challenge for a locked neighbour. Every condition must
 * hold: the node is still locked, its path prerequisite is satisfied (you just
 * cleared the node before it), your logged numbers reach its target, and it
 * hasn't already been offered in this same session.
 */
export function shouldOfferChallenge(input: {
  loggedSets: LoggedSet[]
  targetCriteria: UnlockCriteria | null
  targetUnlocked: boolean
  prerequisiteSatisfied: boolean
  alreadyOfferedThisSession: boolean
}): boolean {
  if (!input.targetCriteria) return false
  if (input.targetUnlocked) return false
  if (!input.prerequisiteSatisfied) return false
  if (input.alreadyOfferedThisSession) return false
  return meetsReadiness(input.loggedSets, input.targetCriteria)
}

export type CascadeAward = {
  count: number
  perNodeXp: number
  perNodePoints: number
  totalXp: number
  totalPoints: number
}

/**
 * XP for the nodes a fast-track challenge skips. The streak multiplier applies
 * to XP (as everywhere) but never to points.
 */
export function cascadeAwards(
  skippedCount: number,
  multiplier = 1,
  baseXp = 200,
  basePoints = 25
): CascadeAward {
  const count = Math.max(0, Math.floor(skippedCount))
  const perNodeXp = Math.round(baseXp * CASCADE_XP_RATE * multiplier)
  const perNodePoints = Math.round(basePoints * CASCADE_XP_RATE)
  return {
    count,
    perNodeXp,
    perNodePoints,
    totalXp: perNodeXp * count,
    totalPoints: perNodePoints * count,
  }
}

/** Does this challenge state still warrant a "Challenge Ready" badge? */
export function hasOpenChallenge(status: string | null | undefined): boolean {
  return (
    !!status && OPEN_CHALLENGE_STATUSES.includes(status as ChallengeStatus)
  )
}
