// Pure skill-unlock + PR rules (spec §2.1, §3.1). Tested specification of the
// logic inside complete_workout's unlock/PR blocks (the sole writer of these
// awards, rule 6). Keep in lockstep with the SQL — same pattern as
// lib/game/streak.ts and lib/game/nutrition.ts.

export const SKILL_UNLOCK_XP = { xp: 200, points: 25 } as const
export const PR_XP = { xp: 75, points: 10 } as const

export type UnlockCriteria =
  | { kind: "reps"; sets: number; reps: number; description?: string }
  | { kind: "hold"; sets: number; seconds: number; description?: string }
  // Endurance kinds (Phase 3). `activities` lists the activity slugs that
  // count, so a jog with 5 km logged is a 5 km run in every sense that matters.
  | {
      kind: "distance"
      activities: string[]
      km: number
      description?: string
    }
  | {
      kind: "pace"
      activities: string[]
      /** The session must be at least this far to count at all. */
      minKm: number
      /** Average minutes per kilometre, at most. Lower is faster. */
      maxPacePerKm: number
      description?: string
    }
  | {
      kind: "frequency"
      activities: string[]
      count: number
      windowDays: number
      description?: string
    }

/** The sets-based kinds — what the check-off and challenge flows speak. */
export type SetsCriteria = Extract<
  UnlockCriteria,
  { kind: "reps" } | { kind: "hold" }
>

/** The session-based kinds — what a logged run or ride is judged against. */
export type EnduranceCriteria = Exclude<UnlockCriteria, SetsCriteria>

/** A set as stored in workout_sets: one of reps/seconds is populated. */
export type LoggedSet = { reps: number | null; seconds: number | null }

/** A duration-based session, as stored on the workouts row. */
export type LoggedSession = {
  activitySlug: string
  durationMin: number
  distanceKm: number | null
  /** Calendar date of the session (YYYY-MM-DD, Mexico City). */
  date: string
}

/** True when a criterion is judged on sessions rather than sets. */
export function isEnduranceCriteria(
  criteria: UnlockCriteria
): criteria is EnduranceCriteria {
  return (
    criteria.kind === "distance" ||
    criteria.kind === "pace" ||
    criteria.kind === "frequency"
  )
}

/** Average minutes per kilometre, or null when there is no distance to divide by. */
export function pacePerKm(session: LoggedSession): number | null {
  if (!session.distanceKm || session.distanceKm <= 0) return null
  if (session.durationMin <= 0) return null
  return session.durationMin / session.distanceKm
}

/**
 * Whether logged sessions satisfy an endurance criterion.
 *
 * `distance` and `pace` are judged on a SINGLE session — you either covered the
 * distance in one go or you didn't; adding up a week of short runs is not a
 * 10 km run. `frequency` is judged across the window, which is the whole point
 * of it.
 *
 * `today` anchors the rolling window; sessions outside it are ignored.
 */
export function meetsEnduranceCriteria(
  criteria: UnlockCriteria,
  sessions: LoggedSession[],
  today: string
): boolean {
  if (!isEnduranceCriteria(criteria)) return false

  const qualifying = sessions.filter((s) =>
    criteria.activities.includes(s.activitySlug)
  )

  if (criteria.kind === "distance") {
    return qualifying.some((s) => (s.distanceKm ?? 0) >= criteria.km)
  }

  if (criteria.kind === "pace") {
    return qualifying.some((s) => {
      if ((s.distanceKm ?? 0) < criteria.minKm) return false
      const pace = pacePerKm(s)
      return pace !== null && pace <= criteria.maxPacePerKm
    })
  }

  // frequency: sessions inside the rolling window ending today.
  const cutoff = addDaysIso(today, -(criteria.windowDays - 1))
  const inWindow = qualifying.filter((s) => s.date >= cutoff && s.date <= today)
  return inWindow.length >= criteria.count
}

/** Date-string arithmetic at UTC noon, so DST can never shift the day. */
function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

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
  if (criteria.kind === "hold") {
    const qualifying = sets.filter(
      (s) => (s.seconds ?? 0) >= criteria.seconds
    ).length
    return qualifying >= criteria.sets
  }
  // An endurance criterion is never satisfied by sets — it is judged on
  // sessions, by meetsEnduranceCriteria.
  return false
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
