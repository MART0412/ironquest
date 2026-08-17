"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { CASCADE_XP_RATE } from "@/lib/game/challenges"
import { milestoneById, type MilestoneAward } from "@/lib/game/equivalences"
import { SKILL_UNLOCK_XP } from "@/lib/game/skills"

/** One thing worth stopping the app for. */
export type CelebrationEntry = {
  key: string
  eyebrow: string
  title: string
  icon: string
  xp: number
  points: number
  /** Optional second line under the title. */
  note?: string
}

/** A skill unlock as returned by complete_workout / attempt_challenge. */
export type UnlockEntry = {
  exercise_id: string
  name: string
  xp: number
  /** True for a skill credited by a fast-track cascade (reduced award). */
  cascaded?: boolean
}

const CASCADE_POINTS = Math.round(SKILL_UNLOCK_XP.points * CASCADE_XP_RATE)

export function unlockEntries(unlocks: UnlockEntry[]): CelebrationEntry[] {
  return unlocks.map((unlock) => ({
    key: `unlock:${unlock.exercise_id}`,
    eyebrow: unlock.cascaded ? "Skill credited" : "Skill unlocked",
    title: unlock.name,
    icon: unlock.cascaded ? "🎖️" : "🔓",
    xp: unlock.xp,
    points: unlock.cascaded ? CASCADE_POINTS : SKILL_UNLOCK_XP.points,
    note: unlock.cascaded
      ? "Skipped on your way up — credited at the reduced rate."
      : undefined,
  }))
}

/**
 * Milestone copy lives in lib/game/equivalences.ts; the server only sends the
 * id, so an award for a milestone this build doesn't know about is skipped
 * rather than rendered blank.
 */
export function milestoneEntries(awards: MilestoneAward[]): CelebrationEntry[] {
  return awards.flatMap((award) => {
    const milestone = milestoneById(award.milestone_id)
    if (!milestone) return []
    return [
      {
        key: `milestone:${award.milestone_id}`,
        eyebrow: "Milestone",
        title: milestone.label,
        icon: "🏔️",
        xp: award.xp,
        points: award.points,
        note: milestone.message,
      },
    ]
  })
}

/**
 * Full-screen ceremony, stepped through one entry at a time. Shared by workout
 * completion, challenge attempts and milestone crossings so everything worth
 * celebrating lands the same way.
 */
export function Celebration({
  entries,
  onDone,
}: {
  entries: CelebrationEntry[]
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const entry = entries[index]
  if (!entry) return null

  const total = entries.length

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="text-6xl">{entry.icon}</div>
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            {entry.eyebrow}
          </p>
          <h1 className="font-heading text-4xl font-semibold">{entry.title}</h1>
          {entry.note && (
            <p className="text-sm text-muted-foreground">{entry.note}</p>
          )}
          {total > 1 && (
            <p className="text-xs text-muted-foreground">
              {index + 1} of {total}
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-3xl font-semibold">+{entry.xp} XP</p>
          <p className="text-muted-foreground">+{entry.points} points</p>
        </div>

        <Button
          size="lg"
          className="h-12 w-full"
          onClick={() => {
            if (index + 1 < total) setIndex(index + 1)
            else onDone()
          }}
        >
          {index + 1 < total ? "Next" : "Continue"}
        </Button>
      </main>
    </div>
  )
}
