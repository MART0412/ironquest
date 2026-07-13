"use client"

import { Plus, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { MacroRings } from "@/components/home/macro-rings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  deleteMealLog,
  logManualMeal,
  relogFood,
  type LogMealResult,
} from "@/lib/actions/nutrition"
import { cn } from "@/lib/utils"

export type TimelineEntry = {
  id: string
  time: string
  name: string
  serving: string | null
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export type LibraryFood = {
  id: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  serving: string | null
}

const AWARD_LABELS: Record<string, string> = {
  protein_target: "Protein target hit",
  meals_logged: "All meals logged",
  calorie_target: "Calorie target",
}

const EMPTY_FORM = {
  name: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  serving: "",
}

type Tab = "recent" | "frequent" | "mine"

export function NutritionView({
  targets,
  consumed,
  entries,
  myFoods,
  recent,
  frequent,
}: {
  targets: { calTarget: number; proteinG: number; carbsG: number; fatG: number }
  consumed: { kcal: number; protein: number; carbs: number; fat: number }
  entries: TimelineEntry[]
  myFoods: LibraryFood[]
  recent: LibraryFood[]
  frequent: LibraryFood[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("recent")
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [save, setSave] = useState(true)
  const [banner, setBanner] = useState<LogMealResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const lists: Record<Tab, LibraryFood[]> = {
    recent,
    frequent,
    mine: myFoods,
  }

  function handleResult(
    response: { error: string } | { result: LogMealResult }
  ) {
    if ("error" in response) {
      setError(response.error)
    } else {
      setBanner(response.result)
      setForm(EMPTY_FORM)
      setFormOpen(false)
      router.refresh()
    }
  }

  function submitManual() {
    setError(null)
    startTransition(async () => {
      handleResult(
        await logManualMeal({
          name: form.name,
          kcal: Number(form.kcal),
          protein: Number(form.protein) || 0,
          carbs: Number(form.carbs) || 0,
          fat: Number(form.fat) || 0,
          serving: form.serving || undefined,
          save,
        })
      )
    })
  }

  function relog(food: LibraryFood) {
    setError(null)
    startTransition(async () => {
      handleResult(await relogFood({ foodId: food.id }))
    })
  }

  function remove(id: string) {
    setError(null)
    startTransition(async () => {
      const response = await deleteMealLog(id)
      if ("error" in response) setError(response.error)
      else router.refresh()
    })
  }

  const rounded = {
    kcal: Math.round(consumed.kcal),
    protein: Math.round(consumed.protein),
    carbs: Math.round(consumed.carbs),
    fat: Math.round(consumed.fat),
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Home
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Nutrition</h1>
      </header>

      <MacroRings
        calTarget={targets.calTarget}
        proteinG={targets.proteinG}
        carbsG={targets.carbsG}
        fatG={targets.fatG}
        consumed={rounded}
      />

      {banner && (
        <div
          className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"
          role="status"
        >
          {banner.awards.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {banner.awards.map((a) => (
                <li key={`${a.action}-${a.for_day ?? "today"}`} className="font-medium">
                  +{a.xp} XP — {AWARD_LABELS[a.action] ?? a.action}
                  {a.for_day && (
                    <span className="text-muted-foreground"> ({a.for_day})</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Logged. {banner.day.count} entr{banner.day.count === 1 ? "y" : "ies"} today.</p>
          )}
          {banner.milestones > 0 && (
            <p className="mt-1 font-medium">🏆 Streak milestone reached!</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* One-tap library */}
      <section className="flex flex-col gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
          {(
            [
              ["recent", "Recent"],
              ["frequent", "Frequent"],
              ["mine", "My Foods"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-sm transition-colors",
                tab === key
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {lists[tab].length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {tab === "mine"
              ? "Nothing saved yet — add a food below with “Save to My Foods” on."
              : "Nothing here yet — foods you log will show up for one-tap re-logging."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {lists[tab].map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => relog(f)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {f.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(f.kcal)} kcal · P{Math.round(f.protein)} C
                      {Math.round(f.carbs)} F{Math.round(f.fat)}
                      {f.serving ? ` · ${f.serving}` : ""}
                    </span>
                  </span>
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Manual quick-add */}
      <section className="flex flex-col gap-3">
        {!formOpen ? (
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setFormOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Add food manually
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="food-name">Name</Label>
              <Input
                id="food-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tacos de guisado (2)"
                className="h-11"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MacroField
                id="kcal"
                label="Calories"
                value={form.kcal}
                onChange={(v) => setForm({ ...form, kcal: v })}
              />
              <MacroField
                id="protein"
                label="Protein (g)"
                value={form.protein}
                onChange={(v) => setForm({ ...form, protein: v })}
              />
              <MacroField
                id="carbs"
                label="Carbs (g)"
                value={form.carbs}
                onChange={(v) => setForm({ ...form, carbs: v })}
              />
              <MacroField
                id="fat"
                label="Fat (g)"
                value={form.fat}
                onChange={(v) => setForm({ ...form, fat: v })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="serving">Serving (optional)</Label>
              <Input
                id="serving"
                value={form.serving}
                onChange={(e) => setForm({ ...form, serving: e.target.value })}
                placeholder="1 plato"
                className="h-11"
              />
            </div>
            <button
              type="button"
              onClick={() => setSave(!save)}
              aria-pressed={save}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded border",
                  save ? "border-primary bg-primary text-primary-foreground" : "border-input"
                )}
              >
                {save && "✓"}
              </span>
              Save to My Foods for one-tap re-logging
            </button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setFormOpen(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={submitManual}
                disabled={pending || !form.name.trim() || form.kcal === ""}
              >
                {pending ? "Logging…" : "Log it"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Today's timeline */}
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-medium">Today</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet today.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <span className="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {e.time}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(e.kcal)} kcal · P{Math.round(e.protein)} C
                    {Math.round(e.carbs)} F{Math.round(e.fat)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${e.name}`}
                  disabled={pending}
                  onClick={() => remove(e.id)}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function MacroField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
      />
    </div>
  )
}
