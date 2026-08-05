import { describe, expect, it } from "vitest"

import {
  ADAPTATION,
  evaluateAdaptation,
  suppressedByDismissal,
  type Difficulty,
  type Prescription,
  type SessionFeedback,
} from "./adaptation"

const session = (at: string, ...difficulties: (Difficulty | null)[]): SessionFeedback => ({
  at,
  difficulties,
})

const reps = (sets: number, repsOrSeconds: number): Prescription => ({
  sets,
  repsOrSeconds,
  isHold: false,
})

const hold = (sets: number, repsOrSeconds: number): Prescription => ({
  sets,
  repsOrSeconds,
  isHold: true,
})

describe("evaluateAdaptation — history requirements", () => {
  it("proposes nothing with no history at all", () => {
    expect(evaluateAdaptation({ sessions: [], prescription: reps(3, 8) }).kind).toBe(
      "none"
    )
  })

  it("proposes nothing after a single session, however it felt", () => {
    const easy = evaluateAdaptation({
      sessions: [session("d1", "easy", "easy", "easy")],
      prescription: reps(3, 8),
    })
    const hardOne = evaluateAdaptation({
      sessions: [session("d1", "hard", "hard", "hard")],
      prescription: reps(3, 8),
    })
    expect(easy.kind).toBe("none")
    expect(hardOne.kind).toBe("none")
  })

  it("only looks at the last WINDOW sessions", () => {
    // Two easy sessions, then a normal one → the easy streak is broken.
    const result = evaluateAdaptation({
      sessions: [
        session("d1", "easy", "easy", "easy"),
        session("d2", "easy", "easy", "easy"),
        session("d3", "normal", "normal", "normal"),
      ],
      prescription: reps(3, 8),
    })
    expect(result.kind).toBe("none")
    expect(ADAPTATION.WINDOW).toBe(3)
  })
})

describe("evaluateAdaptation — increment ladder", () => {
  it("adds a rep after two easy sessions", () => {
    const result = evaluateAdaptation({
      sessions: [
        session("d1", "easy", "easy", "easy"),
        session("d2", "easy", "easy", "easy"),
      ],
      prescription: reps(3, 8),
    })
    expect(result.kind).toBe("increment")
    expect(result.proposal).toEqual({ sets: 3, repsOrSeconds: 9, isHold: false })
  })

  it("treats exactly 80% easy as easy enough", () => {
    // 4 of 5 sets easy = 0.8 exactly.
    const s = () => session("d", "easy", "easy", "easy", "easy", "normal")
    const result = evaluateAdaptation({
      sessions: [s(), s()],
      prescription: reps(3, 8),
    })
    expect(result.kind).toBe("increment")
  })

  it("does not propose at 75% easy", () => {
    const s = () => session("d", "easy", "easy", "easy", "normal")
    expect(
      evaluateAdaptation({ sessions: [s(), s()], prescription: reps(3, 8) }).kind
    ).toBe("none")
  })

  it("adds a set instead of a rep at the rep ceiling", () => {
    const s = () => session("d", "easy", "easy", "easy")
    const result = evaluateAdaptation({
      sessions: [s(), s()],
      prescription: reps(3, ADAPTATION.REP_CEILING),
    })
    expect(result.kind).toBe("increment")
    expect(result.proposal).toEqual({
      sets: 4,
      repsOrSeconds: ADAPTATION.REP_CEILING,
      isHold: false,
    })
  })

  it("proposes the next progression once both ceilings are hit", () => {
    const s = () => session("d", "easy", "easy", "easy")
    const result = evaluateAdaptation({
      sessions: [s(), s()],
      prescription: reps(ADAPTATION.SET_CEILING, ADAPTATION.REP_CEILING),
    })
    expect(result.kind).toBe("next_progression")
    expect(result.proposal).toBeUndefined()
  })

  it("grows holds in seconds with their own step and ceiling", () => {
    const s = () => session("d", "easy", "easy", "easy")
    const grown = evaluateAdaptation({
      sessions: [s(), s()],
      prescription: hold(3, 20),
    })
    expect(grown.proposal).toEqual({
      sets: 3,
      repsOrSeconds: 20 + ADAPTATION.HOLD_STEP,
      isHold: true,
    })

    const capped = evaluateAdaptation({
      sessions: [s(), s()],
      prescription: hold(3, ADAPTATION.HOLD_CEILING),
    })
    expect(capped.proposal).toEqual({
      sets: 4,
      repsOrSeconds: ADAPTATION.HOLD_CEILING,
      isHold: true,
    })
  })

  it("never overshoots the ceiling when the step would pass it", () => {
    const s = () => session("d", "easy", "easy", "easy")
    const result = evaluateAdaptation({
      sessions: [s(), s()],
      prescription: hold(3, ADAPTATION.HOLD_CEILING - 2),
    })
    expect(result.proposal?.repsOrSeconds).toBe(ADAPTATION.HOLD_CEILING)
  })
})

describe("evaluateAdaptation — hold and deload", () => {
  it("proposes a hold when only the latest session was hard", () => {
    const result = evaluateAdaptation({
      sessions: [
        session("d1", "normal", "normal", "normal"),
        session("d2", "hard", "hard", "normal"),
      ],
      prescription: reps(3, 10),
    })
    expect(result.kind).toBe("hold")
    expect(result.proposal).toEqual({ sets: 3, repsOrSeconds: 10, isHold: false })
  })

  it("treats exactly 50% hard as hard", () => {
    const result = evaluateAdaptation({
      sessions: [
        session("d1", "normal", "normal"),
        session("d2", "hard", "normal"),
      ],
      prescription: reps(3, 10),
    })
    expect(result.kind).toBe("hold")
  })

  it("deloads 20% of the reps after two hard sessions", () => {
    const s = () => session("d", "hard", "hard", "normal")
    const result = evaluateAdaptation({
      sessions: [s(), s()],
      prescription: reps(3, 10),
    })
    expect(result.kind).toBe("deload")
    // 10 × 0.8 = 8, sets unchanged.
    expect(result.proposal).toEqual({ sets: 3, repsOrSeconds: 8, isHold: false })
  })

  it("rounds the deload and never goes below one rep", () => {
    const s = () => session("d", "hard", "hard")
    // 7 × 0.8 = 5.6 → 6
    expect(
      evaluateAdaptation({ sessions: [s(), s()], prescription: reps(3, 7) })
        .proposal?.repsOrSeconds
    ).toBe(6)
    // 1 × 0.8 = 0.8 → floored at 1
    expect(
      evaluateAdaptation({ sessions: [s(), s()], prescription: reps(3, 1) })
        .proposal?.repsOrSeconds
    ).toBe(1)
  })

  it("lets hard beat easy inside the same window", () => {
    const result = evaluateAdaptation({
      sessions: [
        session("d1", "easy", "easy", "easy"),
        session("d2", "hard", "hard", "easy"),
      ],
      prescription: reps(3, 10),
    })
    expect(result.kind).toBe("hold")
  })

  it("prefers a deload over a hold when both apply", () => {
    const s = () => session("d", "hard", "hard", "hard")
    expect(
      evaluateAdaptation({ sessions: [s(), s()], prescription: reps(3, 10) }).kind
    ).toBe("deload")
  })
})

describe("evaluateAdaptation — missing signals", () => {
  it("reads null difficulty as normal", () => {
    const s = () => session("d", null, null, null)
    expect(
      evaluateAdaptation({ sessions: [s(), s()], prescription: reps(3, 8) }).kind
    ).toBe("none")
  })

  it("a mostly-unanswered session cannot reach the easy threshold", () => {
    // One easy of three sets = 0.33.
    const s = () => session("d", "easy", null, null)
    expect(
      evaluateAdaptation({ sessions: [s(), s()], prescription: reps(3, 8) }).kind
    ).toBe("none")
  })

  it("ignores a session with no sets rather than dividing by zero", () => {
    const result = evaluateAdaptation({
      sessions: [session("d1"), session("d2")],
      prescription: reps(3, 8),
    })
    expect(result.kind).toBe("none")
  })
})

describe("suppressedByDismissal", () => {
  const dismissal = { kind: "increment" as const, fromSets: 3, fromReps: 8 }

  it("silences the same suggestion at the same prescription", () => {
    expect(suppressedByDismissal("increment", reps(3, 8), [dismissal])).toBe(true)
  })

  it("lets the suggestion through once the prescription changes", () => {
    expect(suppressedByDismissal("increment", reps(3, 9), [dismissal])).toBe(false)
    expect(suppressedByDismissal("increment", reps(4, 8), [dismissal])).toBe(false)
  })

  it("does not let one dismissal silence a different kind of change", () => {
    expect(suppressedByDismissal("deload", reps(3, 8), [dismissal])).toBe(false)
  })

  it("treats \"none\" as nothing worth showing", () => {
    expect(suppressedByDismissal("none", reps(3, 8), [])).toBe(true)
  })
})
