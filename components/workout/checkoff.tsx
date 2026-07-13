"use client"

import { Check, Pencil } from "lucide-react"
import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  completeWorkout,
  type CompleteWorkoutResult,
} from "@/lib/actions/workouts"
import type { Weekday } from "@/lib/data/splits"
import { cn } from "@/lib/utils"

type CheckoffItem = {
  exerciseId: string
  exerciseName: string
  sets: number
  repsOrSeconds: number
  isHold: boolean
}

type CheckoffRoutine = {
  id: string
  name: string
  items: CheckoffItem[]
}

/** Per-item check state: undefined = unchecked; otherwise the (possibly adjusted) prescription. */
type Checked = Record<number, { sets: number; repsOrSeconds: number } | undefined>

const DAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

export function WorkoutCheckoff({
  scheduled,
  others,
  completedRoutineIds,
  todayWeekday,
}: {
  scheduled: CheckoffRoutine[]
  others: CheckoffRoutine[]
  completedRoutineIds: string[]
  todayWeekday: Weekday
}) {
  const router = useRouter()
  const firstOpen = scheduled.find((r) => !completedRoutineIds.includes(r.id))
  const [active, setActive] = useState<CheckoffRoutine | null>(firstOpen ?? null)
  const [checked, setChecked] = useState<Checked>({})
  const [adjusting, setAdjusting] = useState<number | null>(null)
  const [result, setResult] = useState<CompleteWorkoutResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Long-press plumbing: a 500ms hold opens the adjuster and suppresses the
  // tap-toggle that would otherwise fire on release.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFired = useRef(false)

  function startHold(index: number) {
    holdFired.current = false
    holdTimer.current = setTimeout(() => {
      holdFired.current = true
      openAdjuster(index)
    }, 500)
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  function openAdjuster(index: number) {
    if (!active) return
    const item = active.items[index]
    setChecked((c) => ({
      ...c,
      [index]: c[index] ?? { sets: item.sets, repsOrSeconds: item.repsOrSeconds },
    }))
    setAdjusting(index)
  }

  function toggle(index: number) {
    if (holdFired.current) return // long-press already handled this gesture
    if (!active) return
    const item = active.items[index]
    setAdjusting(null)
    setChecked((c) => ({
      ...c,
      [index]: c[index]
        ? undefined
        : { sets: item.sets, repsOrSeconds: item.repsOrSeconds },
    }))
  }

  function adjust(index: number, field: "sets" | "repsOrSeconds", delta: number) {
    const max = field === "sets" ? 10 : 600
    setChecked((c) => {
      const cur = c[index]
      if (!cur) return c
      return {
        ...c,
        [index]: {
          ...cur,
          [field]: Math.min(max, Math.max(1, cur[field] + delta)),
        },
      }
    })
  }

  function selectRoutine(routine: CheckoffRoutine | null) {
    setActive(routine)
    setChecked({})
    setAdjusting(null)
    setError(null)
  }

  function complete() {
    if (!active) return
    const items = active.items
      .map((item, i) => ({ item, state: checked[i] }))
      .filter((x) => x.state)
      .map(({ item, state }) => ({
        exerciseId: item.exerciseId,
        sets: state!.sets,
        repsOrSeconds: state!.repsOrSeconds,
        isHold: item.isHold,
      }))

    setError(null)
    startTransition(async () => {
      const response = await completeWorkout({ routineId: active.id, items })
      if ("error" in response) {
        setError(response.error)
      } else {
        setResult(response.result)
      }
    })
  }

  const checkedCount = active
    ? active.items.filter((_, i) => checked[i]).length
    : 0

  // ------------------------------------------------------------------ views

  if (result) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <div>
          <p className="text-5xl font-semibold">
            {result.xp > 0 ? `+${result.xp} XP` : "Logged"}
          </p>
          <p className="mt-2 text-muted-foreground">
            {result.action === "scheduled_workout" && "Scheduled workout complete."}
            {result.action === "bonus_workout" && "Bonus workout — nice extra."}
            {result.action === "capped" &&
              "Workout logged. Daily bonus already claimed — no extra XP."}
          </p>
        </div>

        <div className="w-full rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Streak</p>
          <p className="text-2xl font-semibold">
            {result.streak_len} day{result.streak_len === 1 ? "" : "s"}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ×{Number(result.multiplier).toFixed(2)}
            </span>
          </p>
          {result.milestones > 0 && (
            <p className="mt-1 text-sm font-medium">
              🏆 Streak milestone reached — bonus XP awarded!
            </p>
          )}
          {result.reset && (
            <p className="mt-1 text-sm text-muted-foreground">
              Streak restarted today — your XP and level are untouched.
            </p>
          )}
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
              setActive(null)
              setChecked({})
              router.refresh()
            }}
          >
            Log another workout
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-10">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Home
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">
          {DAY_LABELS[todayWeekday]}&apos;s quest
        </h1>
      </header>

      {scheduled.length === 0 && !active && (
        <p className="text-sm text-muted-foreground">
          Rest day — recovery is part of the program. Log your meals to keep the
          streak alive, or pick a routine below for a bonus session.
        </p>
      )}

      {/* Routine selector: scheduled first, then the rest for bonus sessions. */}
      {!active && (
        <div className="flex flex-col gap-3">
          {[...scheduled, ...others].map((r) => {
            const done = completedRoutineIds.includes(r.id)
            const isScheduled = scheduled.some((s) => s.id === r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRoutine(r)}
                className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{r.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {done ? "Done today ✓" : isScheduled ? "Scheduled" : "Bonus"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {r.items.length} exercise{r.items.length === 1 ? "" : "s"}
                </p>
              </button>
            )
          })}
          {scheduled.length === 0 && others.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No routines yet —{" "}
              <Link href="/routines" className="underline underline-offset-4">
                create one first
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {active && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-medium">{active.name}</h2>
            {(scheduled.length + others.length > 1 || !firstOpen) && (
              <Button variant="ghost" size="sm" onClick={() => selectRoutine(null)}>
                Switch
              </Button>
            )}
          </div>

          {completedRoutineIds.includes(active.id) && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              Already completed today — logging it again counts as a bonus
              workout (one bonus per day).
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {active.items.map((item, i) => {
              const state = checked[i]
              const isAdjusting = adjusting === i
              return (
                <li key={`${item.exerciseId}-${i}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={!!state}
                    onClick={() => toggle(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggle(i)
                      }
                    }}
                    onPointerDown={() => startHold(i)}
                    onPointerUp={cancelHold}
                    onPointerLeave={cancelHold}
                    onPointerCancel={cancelHold}
                    onContextMenu={(e) => e.preventDefault()}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors select-none",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      state
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        state
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {state && <Check className="size-4" />}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium leading-snug">
                        {item.exerciseName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(state ?? item).sets} ×{" "}
                        {(state ?? item).repsOrSeconds}
                        {item.isHold ? "s hold" : " reps"}
                        {state &&
                          (state.sets !== item.sets ||
                            state.repsOrSeconds !== item.repsOrSeconds) &&
                          " (adjusted)"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Adjust ${item.exerciseName}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        openAdjuster(i)
                      }}
                    >
                      <Pencil />
                    </Button>
                  </div>

                  {isAdjusting && state && (
                    <div className="mt-1 flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                      <Stepper
                        label="Sets"
                        value={state.sets}
                        onChange={(d) => adjust(i, "sets", d)}
                      />
                      <Stepper
                        label={item.isHold ? "Seconds" : "Reps"}
                        value={state.repsOrSeconds}
                        onChange={(d) => adjust(i, "repsOrSeconds", d)}
                      />
                      <Button size="sm" onClick={() => setAdjusting(null)}>
                        Done
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            size="lg"
            className="h-12"
            onClick={complete}
            disabled={pending || checkedCount === 0}
          >
            {pending
              ? "Completing…"
              : `Complete workout (${checkedCount}/${active.items.length})`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Tap to check off as prescribed · hold or ✎ to adjust
          </p>
        </>
      )}
    </main>
  )
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (delta: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(-1)}
        >
          −
        </Button>
        <span className="w-8 text-center font-medium tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(1)}
        >
          +
        </Button>
      </div>
    </div>
  )
}
