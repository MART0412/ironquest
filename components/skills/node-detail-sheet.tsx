"use client"

import { X } from "lucide-react"
import { useState } from "react"

import Link from "next/link"

import { ChallengePanel } from "@/components/skills/challenge-panel"
import type { BestPerf } from "@/components/skills/skill-tree-view"
import { Button, buttonVariants } from "@/components/ui/button"
import type { AttemptResult } from "@/lib/actions/challenges"
import { isEnduranceCriteria } from "@/lib/game/skills"
import type { PathNode } from "@/lib/game/paths"
import { MX_TZ } from "@/lib/game/streak"
import { cn } from "@/lib/utils"

const dateFmt = new Intl.DateTimeFormat("en", {
  timeZone: MX_TZ,
  year: "numeric",
  month: "short",
  day: "numeric",
})

const STATE_LABEL: Record<PathNode["state"], string> = {
  unlocked: "Unlocked",
  next: "Up next",
  locked: "Locked",
}

export function NodeDetailSheet({
  node,
  best,
  cascadeCount = 0,
  onUnlocked,
  onClose,
}: {
  node: PathNode | null
  best: BestPerf | undefined
  /** Still-locked skills earlier in this path — credited by a fast-track clear. */
  cascadeCount?: number
  onUnlocked: (result: AttemptResult) => void
  onClose: () => void
}) {
  const [attempting, setAttempting] = useState(false)

  if (!node) return null

  const criteria = node.criteria
  // An endurance node is cleared by logging a session, not by beating a rep
  // count, so it has no "your best" bar and no inline attempt panel.
  const endurance = criteria ? isEnduranceCriteria(criteria) : false
  const setsCriteria =
    criteria && (criteria.kind === "reps" || criteria.kind === "hold")
      ? criteria
      : null
  const target =
    setsCriteria?.kind === "reps"
      ? { label: "reps", goal: setsCriteria.reps, have: best?.reps ?? 0 }
      : setsCriteria?.kind === "hold"
        ? { label: "sec", goal: setsCriteria.seconds, have: best?.seconds ?? 0 }
        : null

  // The frontier node is a plain attempt; anything further right is a
  // fast-track that also credits the skills it skips.
  const fastTrack = node.state === "locked"
  const canAttempt = node.state !== "unlocked" && !!setsCriteria

  function close() {
    setAttempting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div className="relative mx-auto w-full max-w-sm rounded-t-2xl border border-border bg-background p-6 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className={cn(
                "text-xs font-medium",
                node.state === "unlocked" && "text-primary",
                node.state === "next" && "text-primary",
                node.state === "locked" && "text-muted-foreground"
              )}
            >
              {STATE_LABEL[node.state]}
              {node.state === "unlocked" && node.unlockedAt && (
                <> · {dateFmt.format(new Date(node.unlockedAt))}</>
              )}
              {node.challengeReady && <> · ⚡ Challenge ready</>}
            </p>
            <h2 className="font-heading text-xl font-semibold">{node.name}</h2>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={close}>
            <X />
          </Button>
        </div>

        {node.demoNotes && (
          <p className="mt-3 text-sm text-muted-foreground">{node.demoNotes}</p>
        )}

        {criteria && (
          <div className="mt-4 rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">Unlock criteria</p>
            <p className="text-sm font-medium">{criteria.description ?? "—"}</p>

            {target && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Your best</span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      target.have >= target.goal ? "text-primary" : "text-foreground"
                    )}
                  >
                    {target.have} / {target.goal} {target.label}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, target.goal > 0 ? (target.have / target.goal) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {node.state === "locked" && node.prerequisiteName && !attempting && !endurance && (
          <p className="mt-4 text-sm text-muted-foreground">
            🔒 Normally you&apos;d unlock{" "}
            <span className="font-medium text-foreground">
              {node.prerequisiteName}
            </span>{" "}
            first — or challenge this one directly.
          </p>
        )}
        {node.state === "next" && !attempting && !endurance && (
          <p className="mt-4 text-sm text-muted-foreground">
            Hit the criteria in a logged workout to light this node and earn{" "}
            <span className="font-medium text-foreground">+200 XP</span>.
          </p>
        )}

        {endurance && node.state !== "unlocked" && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Clear this by logging a session that meets it — the engine reads
              what you logged, same as everywhere else.
            </p>
            <Link
              href="/activity"
              className={buttonVariants({ size: "lg", className: "h-11 w-full" })}
              onClick={close}
            >
              Log activity
            </Link>
          </div>
        )}

        {canAttempt && !attempting && (
          <Button
            className="mt-4 h-11 w-full"
            variant={node.challengeReady || node.state === "next" ? "default" : "outline"}
            onClick={() => setAttempting(true)}
          >
            {fastTrack ? "Challenge this skill" : "Attempt challenge"}
          </Button>
        )}

        {canAttempt && attempting && (
          <ChallengePanel
            target={{
              exerciseId: node.id,
              name: node.name,
              criteria: setsCriteria,
              cascadeCount,
            }}
            fastTrack={fastTrack}
            onResult={(result) => {
              setAttempting(false)
              onUnlocked(result)
            }}
            onCancel={() => setAttempting(false)}
          />
        )}
      </div>
    </div>
  )
}
