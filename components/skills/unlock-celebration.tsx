"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { CASCADE_XP_RATE } from "@/lib/game/challenges"
import { SKILL_UNLOCK_XP } from "@/lib/game/skills"

/** One unlock as returned by complete_workout / attempt_challenge. */
export type UnlockEntry = {
  exercise_id: string
  name: string
  xp: number
  /** True for a skill credited by a fast-track cascade (reduced award). */
  cascaded?: boolean
}

const CASCADE_POINTS = Math.round(SKILL_UNLOCK_XP.points * CASCADE_XP_RATE)

/**
 * Full-screen unlock moment, stepped through one skill at a time. Shared by the
 * workout completion flow and challenge attempts so an unlock always lands the
 * same way, however it was earned.
 */
export function UnlockCelebration({
  unlocks,
  onDone,
}: {
  unlocks: UnlockEntry[]
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const unlock = unlocks[index]
  if (!unlock) return null

  const total = unlocks.length
  const points = unlock.cascaded ? CASCADE_POINTS : SKILL_UNLOCK_XP.points

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl">{unlock.cascaded ? "🎖️" : "🔓"}</div>
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            {unlock.cascaded ? "Skill credited" : "Skill unlocked"}
          </p>
          <h1 className="font-heading text-4xl font-semibold">{unlock.name}</h1>
          {unlock.cascaded && (
            <p className="text-xs text-muted-foreground">
              Skipped on your way up — credited at the reduced rate.
            </p>
          )}
          {total > 1 && (
            <p className="text-xs text-muted-foreground">
              {index + 1} of {total}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-3xl font-semibold">+{unlock.xp} XP</p>
          <p className="text-muted-foreground">+{points} points</p>
        </div>

        <Button
          size="lg"
          className="h-12 w-full"
          onClick={() => {
            if (index + 1 < total) setIndex(index + 1)
            else onDone()
          }}
        >
          {index + 1 < total ? "Next unlock" : "Continue"}
        </Button>
      </main>
    </div>
  )
}
