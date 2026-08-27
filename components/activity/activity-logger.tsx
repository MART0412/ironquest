"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import {
  Celebration,
  milestoneEntries,
  type CelebrationEntry,
} from "@/components/game/celebration"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Stepper } from "@/components/workout/stepper"
import { logActivity, type ActivityResult } from "@/lib/actions/activities"
import {
  ACTIVITY_XP,
  activityXp,
  type Activity,
} from "@/lib/fitness/activities"
import { cn } from "@/lib/utils"

/**
 * Manual session logging: tap a preset, tap Log. Duration is the only required
 * number, because it is the only one every activity has.
 */
export function ActivityLogger({ activities }: { activities: Activity[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Activity | null>(null)
  const [minutes, setMinutes] = useState(0)
  const [distance, setDistance] = useState("")
  const [notes, setNotes] = useState("")
  const [result, setResult] = useState<ActivityResult | null>(null)
  const [celebrating, setCelebrating] = useState<CelebrationEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(activity: Activity) {
    setSelected(activity)
    setMinutes(activity.defaultMinutes)
    setDistance("")
    setError(null)
  }

  function submit() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const response = await logActivity({
        activitySlug: selected.slug,
        durationMin: minutes,
        distanceKm: distance ? Number(distance) : null,
        notes: notes || null,
      })
      if ("error" in response) {
        setError(response.error)
        return
      }
      setResult(response.result)
      const ceremony = milestoneEntries(response.result.equivalences ?? [])
      if (ceremony.length > 0) setCelebrating(ceremony)
      router.refresh()
    })
  }

  if (celebrating && celebrating.length > 0) {
    return (
      <Celebration entries={celebrating} onDone={() => setCelebrating(null)} />
    )
  }

  if (result) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <div>
          <p className="text-5xl font-semibold">
            {result.xp > 0 ? `+${result.xp} XP` : "Logged"}
          </p>
          <p className="mt-2 text-muted-foreground">
            {result.activity_name} · {result.minutes} min
            {result.distance_km ? ` · ${result.distance_km} km` : ""}
          </p>
        </div>

        {result.xp === 0 && result.capped && (
          <p className="w-full rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            You&apos;ve hit today&apos;s activity cap of {ACTIVITY_XP.DAILY_CAP} XP.
            The session is recorded — it just doesn&apos;t pay again today.
          </p>
        )}
        {result.xp > 0 && result.capped && (
          <p className="w-full rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            Partly capped: today&apos;s activity allowance had {result.xp} XP left.
          </p>
        )}

        <div className="w-full rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Streak</p>
          <p className="text-2xl font-semibold">
            {result.streak_len} day{result.streak_len === 1 ? "" : "s"}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ×{Number(result.multiplier).toFixed(2)}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.counted_for_streak
              ? "This session counted as a training day."
              : `Under ${ACTIVITY_XP.STREAK_MIN_MINUTES} minutes, so it didn't count toward the streak.`}
          </p>
          {result.points > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              +{result.points} points banked.
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3">
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            Back home
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setResult(null)
              setSelected(null)
              setNotes("")
            }}
          >
            Log another
          </Button>
        </div>
      </main>
    )
  }

  const estimate = selected
    ? activityXp({ met: selected.met, minutes })
    : 0

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Home
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Log activity</h1>
        <p className="text-xs text-muted-foreground">
          Anything that gets your heart going. XP scales with how long and how
          hard, up to {ACTIVITY_XP.DAILY_CAP} XP a day.
        </p>
      </header>

      <section aria-label="Activities" className="grid grid-cols-2 gap-2">
        {activities.map((activity) => (
          <button
            key={activity.slug}
            type="button"
            aria-pressed={selected?.slug === activity.slug}
            data-activity={activity.slug}
            onClick={() => choose(activity)}
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected?.slug === activity.slug
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            )}
          >
            <p className="text-sm font-medium leading-snug">{activity.name}</p>
            <p className="text-xs text-muted-foreground">
              {activity.defaultMinutes} min · {activity.met} MET
            </p>
          </button>
        ))}
      </section>

      {selected && (
        <section
          aria-label="Session details"
          className="flex flex-col gap-4 rounded-xl border border-border p-4"
        >
          <div className="flex items-center justify-between">
            <Stepper
              label="Minutes"
              value={minutes}
              onChange={(d) => setMinutes((m) => Math.min(600, Math.max(1, m + d * 5)))}
            />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Worth about</p>
              <p className="font-heading text-xl font-semibold tabular-nums">
                {estimate} XP
              </p>
            </div>
          </div>

          {selected.tracksDistance && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="distance">
                Distance <span className="text-muted-foreground">(km, optional)</span>
              </Label>
              <Input
                id="distance"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="5"
                className="h-11"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Felt strong on the hills"
              className="h-11"
            />
          </div>

          {minutes < ACTIVITY_XP.STREAK_MIN_MINUTES && (
            <p className="text-xs text-muted-foreground">
              Under {ACTIVITY_XP.STREAK_MIN_MINUTES} minutes won&apos;t count as a
              training day for your streak.
            </p>
          )}
        </section>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        size="lg"
        className="h-12"
        onClick={submit}
        disabled={pending || !selected}
      >
        {pending ? "Logging…" : selected ? `Log ${selected.name.toLowerCase()}` : "Pick an activity"}
      </Button>
    </main>
  )
}
