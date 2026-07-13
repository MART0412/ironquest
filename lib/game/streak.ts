// Pure XP/streak rules (spec §2.1, §2.2). This module is the tested
// specification of the engine; the complete_workout SQL function (the sole
// writer of xp_ledger/streaks, per CLAUDE.md rule 6) mirrors these rules
// exactly. Keep the two in lockstep — every rule change lands in both.

import type { Weekday } from "@/lib/data/splits"

export const MX_TZ = "America/Mexico_City"

/** XP economy (spec §2.1) — points are never multiplied. */
export const XP_VALUES = {
  scheduled_workout: { xp: 100, points: 10 },
  bonus_workout: { xp: 50, points: 5 },
  streak_milestone: { xp: 100, points: 20 },
} as const

// ---------------------------------------------------------------------------
// Date helpers — all app "days" are calendar dates in America/Mexico_City.
// ---------------------------------------------------------------------------

const mxDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: MX_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** The Mexico City calendar date (YYYY-MM-DD) of a UTC instant. */
export function mxDateOf(instant: Date): string {
  return mxDateFormat.format(instant)
}

/** Date-string arithmetic, timezone-proof (works at UTC noon). */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const WEEKDAY_BY_UTC_DAY: Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
]

/** Weekday key (mon..sun) of a YYYY-MM-DD date string. */
export function weekdayOf(dateStr: string): Weekday {
  return WEEKDAY_BY_UTC_DAY[new Date(`${dateStr}T12:00:00Z`).getUTCDay()]
}

// ---------------------------------------------------------------------------
// Multiplier (spec §2.2): ×1.0 base, +0.05 per full streak week, cap ×1.5.
// ---------------------------------------------------------------------------

export function multiplierFor(streakLen: number): number {
  return Math.min(1 + 0.05 * Math.floor(streakLen / 7), 1.5)
}

/** All XP awards get the multiplier (user decision); result is rounded. */
export function applyMultiplier(baseXp: number, streakLen: number): number {
  return Math.round(baseXp * multiplierFor(streakLen))
}

// ---------------------------------------------------------------------------
// Streak evaluation (spec §2.2) — lazy, with gap-fill.
// ---------------------------------------------------------------------------

/**
 * How a past day qualifies for the streak:
 * - "trained": a completed workout exists that day
 * - "rest_ok": no routine scheduled that weekday AND meals were logged
 * - "miss":    anything else (hardcore: scheduled day skipped, or rest day
 *              without meals)
 */
export type DayStatus = "trained" | "rest_ok" | "miss"

export type StreakState = {
  start: string | null
  len: number
  best: number
}

export type StreakUpdate = {
  start: string | null
  len: number
  best: number
  /** True when an existing streak died (never true for a fresh start). */
  reset: boolean
  /** 7-multiples crossed by this update — one milestone award each. */
  crossedMilestones: number[]
}

/**
 * Evaluate the streak as of `today`, which qualifies via the triggering event
 * (a completed workout). `statusOf` is consulted only for gap days between the
 * last counted day and today.
 *
 * XP is never touched here: a reset changes only start/len (spec §2.2 — level,
 * XP, points, skills all survive; the streak is the only casualty).
 */
export function evaluateStreak(
  prev: StreakState,
  today: string,
  statusOf: (date: string) => DayStatus
): StreakUpdate {
  const fresh = prev.len === 0 || prev.start === null

  let start: string
  let len: number
  let reset = false
  // Milestones are crossed relative to the streak that survives; a fresh or
  // reset streak starts crossing from 0.
  let oldLenForCrossing: number

  if (fresh) {
    start = today
    len = 1
    oldLenForCrossing = 0
  } else {
    const lastDay = addDays(prev.start!, prev.len - 1)

    if (today <= lastDay) {
      // Already counted (or clock weirdness) — no change.
      start = prev.start!
      len = prev.len
      oldLenForCrossing = prev.len
    } else if (today === addDays(lastDay, 1)) {
      start = prev.start!
      len = prev.len + 1
      oldLenForCrossing = prev.len
    } else {
      // Gap: every skipped day must have been a valid streak day.
      let gapOk = true
      let gapDays = 0
      for (let d = addDays(lastDay, 1); d < today; d = addDays(d, 1)) {
        gapDays++
        if (statusOf(d) === "miss") {
          gapOk = false
          break
        }
      }

      if (gapOk) {
        start = prev.start!
        len = prev.len + gapDays + 1
        oldLenForCrossing = prev.len
      } else {
        start = today
        len = 1
        reset = true
        oldLenForCrossing = 0
      }
    }
  }

  const crossedMilestones: number[] = []
  for (let m = (Math.floor(oldLenForCrossing / 7) + 1) * 7; m <= len; m += 7) {
    crossedMilestones.push(m)
  }

  return {
    start,
    len,
    best: Math.max(prev.best, len),
    reset,
    crossedMilestones,
  }
}

// ---------------------------------------------------------------------------
// Workout award decision (spec §2.1).
// ---------------------------------------------------------------------------

export type WorkoutAward = {
  action: "scheduled_workout" | "bonus_workout"
  baseXp: number
  points: number
}

/**
 * - Scheduled (routine assigned to today, first completion of it today): 100/10.
 * - Otherwise a bonus workout: 50/5, capped at one per day.
 * - Over the cap: no award (null) — the workout still logs.
 */
export function workoutAward(input: {
  isScheduledRoutineToday: boolean
  routineAlreadyCompletedToday: boolean
  bonusAlreadyAwardedToday: boolean
}): WorkoutAward | null {
  if (input.isScheduledRoutineToday && !input.routineAlreadyCompletedToday) {
    return { action: "scheduled_workout", ...xpOf("scheduled_workout") }
  }
  if (!input.bonusAlreadyAwardedToday) {
    return { action: "bonus_workout", ...xpOf("bonus_workout") }
  }
  return null
}

function xpOf(action: keyof typeof XP_VALUES) {
  return { baseXp: XP_VALUES[action].xp, points: XP_VALUES[action].points }
}
