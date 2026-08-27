"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  DisciplineList,
  type DisciplineOption,
} from "@/components/game/discipline-picker"
import { Button } from "@/components/ui/button"
import { activateDiscipline } from "@/lib/actions/disciplines"
import { multiclassProgress, MULTICLASS_MIN_LEVEL } from "@/lib/game/disciplines"

/**
 * Manage which disciplines you train. Activation is one-way on purpose —
 * multiclassing is meant to be a commitment, not a toggle you flip weekly.
 */
export function DisciplinesCard({
  options,
  level,
}: {
  options: DisciplineOption[]
  level: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const gate = multiclassProgress(level)
  const activeCount = options.filter((o) => o.state === "active").length

  function activate(slug: string) {
    setError(null)
    setBusySlug(slug)
    startTransition(async () => {
      const response = await activateDiscipline(slug)
      setBusySlug(null)
      if ("error" in response) setError(response.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {!gate.reached && activeCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {/* One template literal: JSX swallows whitespace around expressions
              when the sentence wraps, which ate the space before the dash. */}
          {`A second discipline unlocks at level ${MULTICLASS_MIN_LEVEL} — you're level ${level}, ${gate.remaining} to go.`}
        </p>
      )}

      <DisciplineList
        options={options}
        renderAction={(option) =>
          option.state === "available" ? (
            <Button
              size="sm"
              className="shrink-0"
              disabled={pending}
              onClick={() => activate(option.slug)}
            >
              {busySlug === option.slug ? "…" : "Activate"}
            </Button>
          ) : undefined
        }
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
