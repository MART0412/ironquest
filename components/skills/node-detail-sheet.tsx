"use client"

import { X } from "lucide-react"

import type { BestPerf } from "@/components/skills/skill-tree-view"
import { Button } from "@/components/ui/button"
import type { PositionedNode } from "@/lib/game/skill-tree"
import { MX_TZ } from "@/lib/game/streak"
import { cn } from "@/lib/utils"

const dateFmt = new Intl.DateTimeFormat("en", {
  timeZone: MX_TZ,
  year: "numeric",
  month: "short",
  day: "numeric",
})

const STATE_LABEL: Record<PositionedNode["state"], string> = {
  unlocked: "Unlocked",
  next: "Up next",
  locked: "Locked",
}

export function NodeDetailSheet({
  node,
  best,
  onClose,
}: {
  node: PositionedNode | null
  best: BestPerf | undefined
  onClose: () => void
}) {
  if (!node) return null

  const criteria = node.criteria
  const target =
    criteria?.kind === "reps"
      ? { label: "reps", goal: criteria.reps, have: best?.reps ?? 0 }
      : criteria?.kind === "hold"
        ? { label: "sec", goal: criteria.seconds, have: best?.seconds ?? 0 }
        : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
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
            </p>
            <h2 className="font-heading text-xl font-semibold">{node.name}</h2>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
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

        {node.state === "locked" && node.prerequisiteName && (
          <p className="mt-4 text-sm text-muted-foreground">
            🔒 Unlock <span className="font-medium text-foreground">{node.prerequisiteName}</span> first.
          </p>
        )}
        {node.state === "next" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Hit the criteria in a logged workout to light this node and earn{" "}
            <span className="font-medium text-foreground">+200 XP</span>.
          </p>
        )}
      </div>
    </div>
  )
}
