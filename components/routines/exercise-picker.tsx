"use client"

import { X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Json } from "@/lib/database.types"

export type ExerciseLite = {
  id: string
  slug: string | null
  name: string
  branch: string
  tier: number
  unlock_criteria: Json | null
}

const BRANCH_ORDER = ["push", "pull", "core", "legs", "static"]
const BRANCH_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  core: "Core",
  legs: "Legs",
  static: "Static / Skill",
}

/** Full-screen overlay picker: branch-grouped library with a text filter. */
export function ExercisePicker({
  exercises,
  onPick,
  onClose,
}: {
  exercises: ExerciseLite[]
  onPick: (exercise: ExerciseLite) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? exercises.filter((e) => e.name.toLowerCase().includes(q))
      : exercises
    return BRANCH_ORDER.map((branch) => ({
      branch,
      items: filtered
        .filter((e) => e.branch === branch)
        .sort((a, b) => a.tier - b.tier),
    })).filter((g) => g.items.length > 0)
  }, [exercises, query])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col overflow-hidden px-6 py-6">
        <header className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Add exercise</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </Button>
        </header>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the library…"
          className="mt-3 h-11"
          autoFocus
        />

        <div className="mt-4 flex-1 overflow-y-auto pb-6">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches.</p>
          )}
          {groups.map((g) => (
            <section key={g.branch} className="mb-5">
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {BRANCH_LABELS[g.branch] ?? g.branch}
              </h3>
              <ul className="flex flex-col gap-1">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onPick(e)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="text-sm">{e.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Tier {e.tier}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
