"use client"

import { useState, useTransition } from "react"

import { Stepper } from "@/components/workout/stepper"
import { Button } from "@/components/ui/button"
import {
  attemptChallenge,
  type AttemptResult,
} from "@/lib/actions/challenges"
import type { SetsCriteria } from "@/lib/game/skills"

export type ChallengeTarget = {
  exerciseId: string
  name: string
  /**
   * Sets-based only: an endurance node is cleared by logging a session from
   * /activity, not by an inline attempt panel.
   */
  criteria: SetsCriteria | null
  /** Skills earlier in the path that a fast-track attempt would credit. */
  cascadeCount?: number
}

/**
 * Inline attempt panel: pre-filled with the target's criteria, logged as real
 * workout evidence. The engine — not this form — decides whether it unlocked, so
 * there is no way to declare a skill you didn't perform.
 */
export function ChallengePanel({
  target,
  fastTrack = false,
  onResult,
  onCancel,
}: {
  target: ChallengeTarget
  fastTrack?: boolean
  onResult: (result: AttemptResult) => void
  onCancel: () => void
}) {
  const criteria = target.criteria
  const isHold = criteria?.kind === "hold"
  const goal = criteria
    ? criteria.kind === "hold"
      ? criteria.seconds
      : criteria.reps
    : 1

  const [sets, setSets] = useState(criteria?.sets ?? 3)
  const [value, setValue] = useState(goal)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const cascade = fastTrack ? (target.cascadeCount ?? 0) : 0
  const short = value < goal || sets < (criteria?.sets ?? 1)

  function submit() {
    setError(null)
    setFailed(false)
    startTransition(async () => {
      const response = await attemptChallenge({
        exerciseId: target.exerciseId,
        sets,
        repsOrSeconds: value,
        isHold,
        fastTrack,
      })
      if ("error" in response) {
        setError(response.error)
        return
      }
      if (!response.result.unlocked) {
        setFailed(true)
        return
      }
      onResult(response.result)
    })
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div>
        <p className="text-sm font-medium">
          {fastTrack ? "Fast-track attempt" : "Log your attempt"}
        </p>
        <p className="text-xs text-muted-foreground">
          {criteria?.description ??
            `${criteria?.sets ?? 3} × ${goal}${isHold ? "s" : " reps"}`}{" "}
          — log what you actually did.
        </p>
      </div>

      {cascade > 0 && (
        <p className="rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          Clearing this also credits the{" "}
          <span className="font-medium text-foreground">
            {cascade} skipped skill{cascade === 1 ? "" : "s"}
          </span>{" "}
          before it, at reduced XP.
        </p>
      )}

      <div className="flex items-center justify-between">
        <Stepper
          label="Sets"
          value={sets}
          onChange={(d) => setSets((s) => Math.min(10, Math.max(1, s + d)))}
        />
        <Stepper
          label={isHold ? "Seconds" : "Reps"}
          value={value}
          onChange={(d) => setValue((v) => Math.min(600, Math.max(1, v + d)))}
        />
      </div>

      {short && !failed && (
        <p className="text-xs text-muted-foreground">
          That&apos;s short of the criteria — logging it still counts as
          training, but the skill won&apos;t unlock yet.
        </p>
      )}

      {failed && (
        <p className="text-sm" role="status">
          Not this time — logged as training. The challenge stays available; try
          again whenever you&apos;re ready.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={submit} disabled={pending}>
          {pending ? "Logging…" : failed ? "Try again" : "Log attempt"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          {failed ? "Close" : "Cancel"}
        </Button>
      </div>
    </div>
  )
}
