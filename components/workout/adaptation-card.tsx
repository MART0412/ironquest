"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { decideAdaptation } from "@/lib/actions/adaptation"
import type { AdaptationProposal } from "@/lib/fitness/proposals"

const HEADING: Record<AdaptationProposal["kind"], string> = {
  increment: "📈 Ready for more",
  hold: "✋ Hold steady",
  deload: "🪫 Back off a little",
  next_progression: "🎯 Time for the next progression",
}

/**
 * One volume proposal with accept/dismiss. Nothing here is pre-applied — the
 * routine only changes when the user taps accept, and either choice is logged.
 */
export function AdaptationCard({
  proposal,
  onResolved,
}: {
  proposal: AdaptationProposal
  onResolved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const unit = proposal.current.isHold ? "s" : " reps"
  const changesNumbers =
    !!proposal.proposal &&
    (proposal.proposal.sets !== proposal.current.sets ||
      proposal.proposal.repsOrSeconds !== proposal.current.repsOrSeconds)

  function decide(outcome: "accepted" | "dismissed") {
    setError(null)
    startTransition(async () => {
      const response = await decideAdaptation({
        routineItemId: proposal.routineItemId,
        exerciseId: proposal.exerciseId,
        kind: proposal.kind,
        outcome,
        fromSets: proposal.current.sets,
        fromReps: proposal.current.repsOrSeconds,
        toSets: proposal.proposal?.sets ?? null,
        toReps: proposal.proposal?.repsOrSeconds ?? null,
      })
      if ("error" in response) {
        setError(response.error)
        return
      }
      onResolved()
    })
  }

  return (
    <div className="w-full rounded-xl border border-border bg-muted/30 p-4 text-left">
      <p className="text-sm font-medium">{HEADING[proposal.kind]}</p>
      <p className="mt-0.5 font-medium">{proposal.exerciseName}</p>
      <p className="mt-1 text-sm text-muted-foreground">{proposal.reason}</p>

      {changesNumbers && (
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground line-through">
            {proposal.current.sets}×{proposal.current.repsOrSeconds}
            {unit}
          </span>{" "}
          →{" "}
          <span className="font-semibold">
            {proposal.proposal!.sets}×{proposal.proposal!.repsOrSeconds}
            {unit}
          </span>
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {proposal.kind === "next_progression" ? (
          <>
            <Link
              href="/skills"
              className="flex-1"
              onClick={() => decide("accepted")}
            >
              <Button className="w-full" disabled={pending}>
                View path
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => decide("dismissed")}
              disabled={pending}
            >
              Not yet
            </Button>
          </>
        ) : (
          <>
            <Button
              className="flex-1"
              onClick={() => decide("accepted")}
              disabled={pending}
            >
              {pending
                ? "Saving…"
                : changesNumbers
                  ? "Update my routine"
                  : "Got it"}
            </Button>
            <Button
              variant="outline"
              onClick={() => decide("dismissed")}
              disabled={pending}
            >
              Dismiss
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
