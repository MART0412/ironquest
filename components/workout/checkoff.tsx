"use client"

import { Check, Pencil } from "lucide-react"
import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { ChallengePanel } from "@/components/skills/challenge-panel"
import { AdaptationCard } from "@/components/workout/adaptation-card"
import {
  UnlockCelebration,
  type UnlockEntry,
} from "@/components/skills/unlock-celebration"
import { Button, buttonVariants } from "@/components/ui/button"
import { Stepper } from "@/components/workout/stepper"
import { declineChallenge, type ChallengeOffer } from "@/lib/actions/challenges"
import {
  completeWorkout,
  type CompleteWorkoutResult,
} from "@/lib/actions/workouts"
import type { Weekday } from "@/lib/data/splits"
import type { Difficulty } from "@/lib/fitness/adaptation"
import type { AdaptationProposal } from "@/lib/fitness/proposals"
import { cn } from "@/lib/utils"

type CheckoffItem = {
  routineItemId: string
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
type Checked = Record<
  number,
  { sets: number; repsOrSeconds: number; difficulty: Difficulty | null } | undefined
>

/** One-tap feedback. Untapped stays null — silence isn't a signal. */
const DIFFICULTIES: { value: Difficulty; label: string; icon: string }[] = [
  { value: "easy", label: "Easy", icon: "😌" },
  { value: "normal", label: "OK", icon: "🙂" },
  { value: "hard", label: "Hard", icon: "😤" },
]

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
  // Unlocks still to be celebrated; while non-empty the full-screen moment
  // plays instead of the summary.
  const [celebrating, setCelebrating] = useState<UnlockEntry[] | null>(null)
  // Challenge offers left on the summary, and which one is being attempted.
  const [offers, setOffers] = useState<ChallengeOffer[]>([])
  const [attempting, setAttempting] = useState<string | null>(null)
  // Volume proposals left to answer on the summary.
  const [adaptations, setAdaptations] = useState<AdaptationProposal[]>([])
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
      [index]:
        c[index] ?? {
          sets: item.sets,
          repsOrSeconds: item.repsOrSeconds,
          difficulty: null,
        },
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
        : {
            sets: item.sets,
            repsOrSeconds: item.repsOrSeconds,
            difficulty: null,
          },
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

  /** Tapping the active chip clears it — you can take back a mis-tap. */
  function setDifficulty(index: number, value: Difficulty) {
    setChecked((c) => {
      const cur = c[index]
      if (!cur) return c
      return {
        ...c,
        [index]: { ...cur, difficulty: cur.difficulty === value ? null : value },
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
        routineItemId: item.routineItemId,
        sets: state!.sets,
        repsOrSeconds: state!.repsOrSeconds,
        isHold: item.isHold,
        difficulty: state!.difficulty,
      }))

    setError(null)
    startTransition(async () => {
      const response = await completeWorkout({ routineId: active.id, items })
      if ("error" in response) {
        setError(response.error)
      } else {
        setResult(response.result)
        setOffers(response.result.challenges ?? [])
        setAdaptations(response.result.adaptations ?? [])
        if (response.result.unlocks.length > 0) {
          setCelebrating(response.result.unlocks)
        }
      }
    })
  }

  const checkedCount = active
    ? active.items.filter((_, i) => checked[i]).length
    : 0

  // ------------------------------------------------------------------ views

  // Full-screen unlock moment(s), played before the summary is revealed.
  if (celebrating && celebrating.length > 0) {
    return (
      <UnlockCelebration
        unlocks={celebrating}
        onDone={() => setCelebrating(null)}
      />
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

        {result.unlocks.length > 0 && (
          <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
            <p className="text-sm font-medium">🔓 Skill unlocked</p>
            <ul className="mt-1 flex flex-col gap-1">
              {result.unlocks.map((u) => (
                <li key={u.exercise_id} className="text-sm text-muted-foreground">
                  {u.name} <span className="text-foreground">+{u.xp} XP</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.prs.length > 0 && (
          <div className="w-full rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
            <p className="text-sm font-medium">🏅 Personal record</p>
            <ul className="mt-1 flex flex-col gap-1">
              {result.prs.map((pr) => (
                <li key={pr.exercise_id} className="text-sm text-muted-foreground">
                  {pr.name} — {pr.value}
                  {pr.metric === "seconds" ? "s" : " reps"}{" "}
                  <span className="text-foreground">+{pr.xp} XP</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {adaptations.map((proposal) => (
          <AdaptationCard
            key={proposal.routineItemId}
            proposal={proposal}
            onResolved={() =>
              setAdaptations((list) =>
                list.filter((p) => p.routineItemId !== proposal.routineItemId)
              )
            }
          />
        ))}

        {offers.length > 0 && (
          <div className="w-full rounded-xl border border-primary/40 bg-primary/5 p-4 text-left">
            <p className="text-sm font-medium">⚡ Challenge available</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Today&apos;s numbers say you&apos;re ready. Attempt it now to
              unlock?
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {offers.map((offer) => (
                <li key={offer.exercise_id}>
                  <p className="font-medium">{offer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {offer.criteria?.description ?? "Log the criteria to unlock."}
                  </p>

                  {attempting === offer.exercise_id ? (
                    <ChallengePanel
                      target={{
                        exerciseId: offer.exercise_id,
                        name: offer.name,
                        criteria: offer.criteria,
                      }}
                      onResult={(attempt) => {
                        setAttempting(null)
                        setOffers((o) =>
                          o.filter((x) => x.exercise_id !== offer.exercise_id)
                        )
                        setCelebrating(attempt.unlocks)
                      }}
                      onCancel={() => setAttempting(null)}
                    />
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setAttempting(offer.exercise_id)}
                      >
                        Attempt it
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOffers((o) =>
                            o.filter((x) => x.exercise_id !== offer.exercise_id)
                          )
                          void declineChallenge(offer.exercise_id)
                        }}
                      >
                        Later
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Skipped challenges stay marked ⚡ on your skill paths.
            </p>
          </div>
        )}

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

                  {state && (
                    <div
                      role="group"
                      aria-label={`How did ${item.exerciseName} feel?`}
                      className="mt-1 flex gap-1"
                    >
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={state.difficulty === d.value}
                          onClick={() => setDifficulty(i, d.value)}
                          className={cn(
                            "flex-1 rounded-lg border py-1.5 text-xs transition-colors",
                            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            state.difficulty === d.value
                              ? "border-primary bg-primary/10 font-medium"
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {d.icon} {d.label}
                        </button>
                      ))}
                    </div>
                  )}

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
            Tap to check off as prescribed · hold or ✎ to adjust · the
            easy/OK/hard chips are optional
          </p>
        </>
      )}
    </main>
  )
}
