"use client"

import { ChevronDown, ChevronUp, Plus, X } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ExercisePicker,
  type ExerciseLite,
} from "@/components/routines/exercise-picker"
import { deleteRoutine, saveRoutine } from "@/lib/actions/routines"
import { WEEKDAYS, type Weekday } from "@/lib/data/splits"
import { cn } from "@/lib/utils"

export type EditorItem = {
  exerciseId: string
  exerciseName: string
  sets: number
  repsOrSeconds: number
  isHold: boolean
}

type Initial = {
  id: string
  name: string
  dayOfWeek: Weekday[]
  items: EditorItem[]
}

/** Prefill sets/reps from the exercise's unlock_criteria jsonb when available. */
function defaultsFor(exercise: ExerciseLite): Omit<EditorItem, "exerciseId" | "exerciseName"> {
  const c = exercise.unlock_criteria
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const kind = c.kind
    const sets = typeof c.sets === "number" ? c.sets : 3
    if (kind === "hold" && typeof c.seconds === "number") {
      return { sets, repsOrSeconds: c.seconds, isHold: true }
    }
    if (kind === "reps" && typeof c.reps === "number") {
      return { sets, repsOrSeconds: c.reps, isHold: false }
    }
  }
  return { sets: 3, repsOrSeconds: 10, isHold: false }
}

export function RoutineEditor({
  exercises,
  initial,
}: {
  exercises: ExerciseLite[]
  initial?: Initial
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [days, setDays] = useState<Weekday[]>(initial?.dayOfWeek ?? [])
  const [items, setItems] = useState<EditorItem[]>(initial?.items ?? [])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggleDay(day: Weekday) {
    setDays((d) =>
      d.includes(day) ? d.filter((x) => x !== day) : [...d, day]
    )
  }

  function updateItem(index: number, patch: Partial<EditorItem>) {
    setItems((list) =>
      list.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  function moveItem(index: number, delta: -1 | 1) {
    setItems((list) => {
      const target = index + delta
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function addExercise(exercise: ExerciseLite) {
    setItems((list) => [
      ...list,
      {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        ...defaultsFor(exercise),
      },
    ])
    setPickerOpen(false)
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await saveRoutine({
        id: initial?.id ?? null,
        name: name.trim(),
        dayOfWeek: days,
        items: items.map(({ exerciseId, sets, repsOrSeconds, isHold }) => ({
          exerciseId,
          sets,
          repsOrSeconds,
          isHold,
        })),
      })
      // On success the action redirects; only errors come back.
      if (result?.error) setError(result.error)
    })
  }

  function remove() {
    if (!initial) return
    if (!window.confirm(`Delete "${initial.name}"? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteRoutine(initial.id)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-10">
      <header>
        <Link
          href="/routines"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Routines
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">
          {initial ? "Edit routine" : "New routine"}
        </h1>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="routine-name">Name</Label>
        <Input
          id="routine-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Push Day A"
          className="h-11"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Training days</Label>
        <div className="flex gap-1">
          {WEEKDAYS.map(({ key, label }) => {
            const active = days.includes(key)
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleDay(key)}
                className={cn(
                  "flex-1 rounded-md border py-2 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-primary bg-primary/15 font-medium"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Exercises</Label>
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No exercises yet — add your first below.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={`${item.exerciseId}-${i}`}
              className="rounded-xl border border-border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{item.exerciseName}</p>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => moveItem(i, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Move down"
                    disabled={i === items.length - 1}
                    onClick={() => moveItem(i, 1)}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove"
                    onClick={() =>
                      setItems((list) => list.filter((_, idx) => idx !== i))
                    }
                  >
                    <X />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  aria-label="Sets"
                  value={item.sets}
                  min={1}
                  max={10}
                  onChange={(e) =>
                    updateItem(i, { sets: Number(e.target.value) })
                  }
                  className="h-9 w-16 text-center"
                />
                <span className="text-sm text-muted-foreground">×</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  aria-label={item.isHold ? "Seconds" : "Reps"}
                  value={item.repsOrSeconds}
                  min={1}
                  max={600}
                  onChange={(e) =>
                    updateItem(i, { repsOrSeconds: Number(e.target.value) })
                  }
                  className="h-9 w-20 text-center"
                />
                <button
                  type="button"
                  onClick={() => updateItem(i, { isHold: !item.isHold })}
                  className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                  title="Toggle between reps and seconds"
                >
                  {item.isHold ? "sec hold" : "reps"}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setPickerOpen(true)}
        >
          <Plus data-icon="inline-start" />
          Add exercise
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <footer className="mt-auto flex flex-col gap-3">
        <Button
          type="button"
          size="lg"
          className="h-11"
          onClick={save}
          disabled={pending || name.trim().length < 2 || items.length === 0}
        >
          {pending ? "Saving…" : "Save routine"}
        </Button>
        {initial && (
          <Button
            type="button"
            variant="destructive"
            className="h-11"
            onClick={remove}
            disabled={pending}
          >
            Delete routine
          </Button>
        )}
      </footer>

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  )
}
