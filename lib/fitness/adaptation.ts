// Adaptive volume (Session 13 Part 3). Reads the per-set easy/normal/hard
// signal from recent sessions and PROPOSES a prescription change. Nothing here
// writes anything: a proposal only becomes a change when the user taps accept
// (lib/actions/adaptation.ts), which is the whole point — the app suggests,
// the athlete decides.
//
// Pure and fully tested, like lib/game/streak.ts. No SQL mirror is needed
// because no XP is involved (rule 6 doesn't apply to prescriptions).

export type Difficulty = "easy" | "normal" | "hard"

/** All thresholds in one place so they can be tuned without touching logic. */
export const ADAPTATION = {
  /** Share of a session's sets marked easy that counts as "too easy". */
  EASY_RATIO: 0.8,
  /** Share marked hard that counts as "too hard". */
  HARD_RATIO: 0.5,
  /** Consecutive easy sessions before proposing more volume. */
  EASY_SESSIONS: 2,
  /** Consecutive hard sessions before proposing a deload. */
  HARD_SESSIONS: 2,
  /** How many recent sessions of an exercise are considered. */
  WINDOW: 3,
  /** Minimum sessions of history before any proposal is made. */
  MIN_SESSIONS: 2,
  /** Reps grow one at a time up to here, then sets grow instead. */
  REP_CEILING: 12,
  REP_STEP: 1,
  /** Holds grow in bigger steps; same ladder, different units. */
  HOLD_CEILING: 60,
  HOLD_STEP: 5,
  /** At this many sets the ladder is exhausted — time for a harder skill. */
  SET_CEILING: 5,
  /** Deload keeps the sets and cuts volume to this share. */
  DELOAD_FACTOR: 0.8,
} as const

/** One session's worth of feedback for a single exercise. */
export type SessionFeedback = {
  /** Session identity/order key (ISO date or timestamp). */
  at: string
  /** One entry per logged set; null means the user gave no signal. */
  difficulties: (Difficulty | null)[]
}

export type Prescription = {
  sets: number
  repsOrSeconds: number
  isHold: boolean
}

export type AdaptationKind = "increment" | "hold" | "deload" | "next_progression"

export type Adaptation = {
  kind: AdaptationKind | "none"
  reason: string
  /** Absent for "none" and "next_progression" — those change no numbers. */
  proposal?: Prescription
}

/** A missing signal is not evidence of anything, so it reads as normal. */
function ratio(session: SessionFeedback, target: Difficulty): number {
  const sets = session.difficulties
  if (sets.length === 0) return 0
  const matching = sets.filter((d) => (d ?? "normal") === target).length
  return matching / sets.length
}

/** True when the last `count` sessions all clear `test`. */
function lastSessions(
  sessions: SessionFeedback[],
  count: number,
  test: (s: SessionFeedback) => boolean
): boolean {
  if (sessions.length < count) return false
  return sessions.slice(-count).every(test)
}

const isEasy = (s: SessionFeedback) => ratio(s, "easy") >= ADAPTATION.EASY_RATIO
const isHard = (s: SessionFeedback) => ratio(s, "hard") >= ADAPTATION.HARD_RATIO

/**
 * Evaluate one exercise's recent sessions against its current prescription.
 *
 * `sessions` are chronological (oldest first); only the most recent
 * `ADAPTATION.WINDOW` are considered. Precedence is safety-first:
 * deload > hold > increment.
 */
export function evaluateAdaptation(input: {
  sessions: SessionFeedback[]
  prescription: Prescription
}): Adaptation {
  const window = input.sessions.slice(-ADAPTATION.WINDOW)
  const { sets, repsOrSeconds, isHold } = input.prescription

  if (window.length < ADAPTATION.MIN_SESSIONS) {
    return {
      kind: "none",
      reason: "Not enough history yet — keep logging how sets feel.",
    }
  }

  if (lastSessions(window, ADAPTATION.HARD_SESSIONS, isHard)) {
    const reduced = Math.max(
      1,
      Math.round(repsOrSeconds * ADAPTATION.DELOAD_FACTOR)
    )
    return {
      kind: "deload",
      reason: `Two hard sessions in a row — back off to ${sets}×${reduced} and rebuild.`,
      proposal: { sets, repsOrSeconds: reduced, isHold },
    }
  }

  if (isHard(window[window.length - 1])) {
    return {
      kind: "hold",
      reason: "That one was hard — hold these numbers until it settles.",
      proposal: { sets, repsOrSeconds, isHold },
    }
  }

  if (lastSessions(window, ADAPTATION.EASY_SESSIONS, isEasy)) {
    const ceiling = isHold ? ADAPTATION.HOLD_CEILING : ADAPTATION.REP_CEILING
    const step = isHold ? ADAPTATION.HOLD_STEP : ADAPTATION.REP_STEP
    const unit = isHold ? "s" : " reps"

    if (repsOrSeconds < ceiling) {
      const grown = Math.min(ceiling, repsOrSeconds + step)
      return {
        kind: "increment",
        reason: `Felt easy twice — step up to ${sets}×${grown}${unit}.`,
        proposal: { sets, repsOrSeconds: grown, isHold },
      }
    }

    if (sets < ADAPTATION.SET_CEILING) {
      return {
        kind: "increment",
        reason: `You're at ${repsOrSeconds}${unit} — add a set (${sets + 1}×${repsOrSeconds}${unit}).`,
        proposal: { sets: sets + 1, repsOrSeconds, isHold },
      }
    }

    return {
      kind: "next_progression",
      reason: `${sets}×${repsOrSeconds}${unit} and still easy — this movement has nothing left to teach you. Time for the next progression.`,
    }
  }

  return { kind: "none", reason: "Volume looks right where it is." }
}

/** A previously dismissed proposal, as stored in prescription_adjustments. */
export type Dismissal = {
  kind: AdaptationKind
  fromSets: number | null
  fromReps: number | null
}

/**
 * Whether this proposal was already dismissed *for these exact numbers*.
 * Dismissing silences that suggestion until the prescription actually changes,
 * so the app doesn't nag — but a proposal about a different prescription (or a
 * different kind of change) still gets through.
 */
export function suppressedByDismissal(
  kind: AdaptationKind | "none",
  prescription: Prescription,
  dismissals: Dismissal[]
): boolean {
  if (kind === "none") return true
  return dismissals.some(
    (d) =>
      d.kind === kind &&
      d.fromSets === prescription.sets &&
      d.fromReps === prescription.repsOrSeconds
  )
}
