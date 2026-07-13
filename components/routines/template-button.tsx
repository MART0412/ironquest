"use client"

import { useState, useTransition } from "react"

import { applySplitTemplate } from "@/lib/actions/routines"
import type { SplitKey } from "@/lib/data/splits"
import { cn } from "@/lib/utils"

export function TemplateButton({
  splitKey,
  name,
  description,
}: {
  splitKey: SplitKey
  name: string
  description: string
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  function apply() {
    setMessage(null)
    startTransition(async () => {
      const result = await applySplitTemplate(splitKey)
      if ("error" in result) {
        setIsError(true)
        setMessage(result.error)
      } else {
        setIsError(false)
        setMessage(
          result.created === 0
            ? "Already in place — nothing to add."
            : `Added ${result.created} routine${result.created === 1 ? "" : "s"}.`
        )
      }
    })
  }

  return (
    <button
      type="button"
      onClick={apply}
      disabled={pending}
      className={cn(
        "rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pending && "opacity-60"
      )}
    >
      <p className="font-medium">{pending ? "Creating…" : name}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      {message && (
        <p
          className={cn(
            "mt-2 text-sm",
            isError ? "text-destructive" : "text-foreground"
          )}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </button>
  )
}
