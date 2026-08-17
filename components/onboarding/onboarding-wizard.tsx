"use client"

import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { DisciplineList } from "@/components/game/discipline-picker"
import { OptionCard } from "@/components/onboarding/option-card"
import { completeOnboarding } from "@/lib/actions/onboarding"
import { SPLIT_TEMPLATES, WEEKDAYS, type SplitKey } from "@/lib/data/splits"
import {
  ACTIVITY_LEVELS,
  ageFromDob,
  cutTargets,
  type ActivityLevel,
  type Sex,
} from "@/lib/fitness/tdee"
import { Avatar } from "@/components/profile/avatar"
import { resolveCharacter, type AvatarCharacter } from "@/lib/game/avatar"
import {
  canActivate,
  MULTICLASS_MIN_LEVEL,
  type DisciplineOption,
} from "@/lib/game/disciplines"

type WizardData = {
  displayName: string
  sex: Sex | ""
  avatarCharacter: AvatarCharacter | ""
  dob: string
  heightCm: string
  weightKg: string
  activity: ActivityLevel | ""
  calTarget: string
  proteinG: string
  carbsG: string
  fatG: string
  disciplineSlug: string
  splitKey: SplitKey | ""
}

const EMPTY: WizardData = {
  displayName: "",
  sex: "",
  avatarCharacter: "",
  dob: "",
  heightCm: "",
  weightKg: "",
  activity: "",
  calTarget: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  disciplineSlug: "",
  splitKey: "",
}

// Step order lives in data, so inserting a step never means renumbering cases.
const STEPS = [
  "name",
  "sex",
  "character",
  "dob",
  "body",
  "activity",
  "targets",
  "discipline",
  "split",
] as const
type StepId = (typeof STEPS)[number]
const STEP_COUNT = STEPS.length

export function OnboardingWizard({
  disciplines,
}: {
  disciplines: DisciplineOption[]
}) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) =>
    setData((d) => ({ ...d, [key]: value }))

  const stepId: StepId = STEPS[step]

  // Whether the current step has enough valid input to advance.
  const canAdvance = useMemo(() => {
    switch (STEPS[step]) {
      case "name":
        return data.displayName.trim().length >= 2
      case "sex":
        return data.sex !== ""
      case "character":
        return data.avatarCharacter !== ""
      case "dob": {
        if (!data.dob) return false
        const age = ageFromDob(data.dob)
        return age >= 13 && age <= 120
      }
      case "body": {
        const h = Number(data.heightCm)
        const w = Number(data.weightKg)
        return h >= 100 && h <= 250 && w >= 30 && w <= 300
      }
      case "activity":
        return data.activity !== ""
      case "targets":
        return (
          Number(data.calTarget) > 0 &&
          Number(data.proteinG) >= 0 &&
          Number(data.carbsG) >= 0 &&
          Number(data.fatG) >= 0
        )
      case "discipline":
        return data.disciplineSlug !== ""
      case "split":
        return data.splitKey !== ""
      default:
        return false
    }
  }, [step, data])

  function goNext() {
    setError(null)
    // Compute suggested targets when leaving the activity step (targets is next).
    if (stepId === "activity" && data.sex && data.activity) {
      const t = cutTargets({
        sex: data.sex,
        weightKg: Number(data.weightKg),
        heightCm: Number(data.heightCm),
        age: ageFromDob(data.dob),
        activity: data.activity,
      })
      setData((d) => ({
        ...d,
        calTarget: String(t.calTarget),
        proteinG: String(t.proteinG),
        carbsG: String(t.carbsG),
        fatG: String(t.fatG),
      }))
    }
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  }

  function goBack() {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  function finish() {
    if (!data.sex || !data.activity || !data.splitKey || !data.disciplineSlug) return
    setError(null)
    startTransition(async () => {
      const result = await completeOnboarding({
        displayName: data.displayName.trim(),
        sex: data.sex as Sex,
        avatarCharacter: (data.avatarCharacter ||
          resolveCharacter(data.sex, null)) as AvatarCharacter,
        dob: data.dob,
        heightCm: Number(data.heightCm),
        weightKg: Number(data.weightKg),
        activity: data.activity as ActivityLevel,
        calTarget: Number(data.calTarget),
        proteinG: Number(data.proteinG),
        carbsG: Number(data.carbsG),
        fatG: Number(data.fatG),
        splitKey: data.splitKey as SplitKey,
        disciplineSlug: data.disciplineSlug,
      })
      // On success the action redirects; only errors return here.
      if (result?.error) setError(result.error)
    })
  }

  const isLast = step === STEP_COUNT - 1

  return (
    <div className="flex min-h-dvh flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <header className="mb-8">
          <Progress value={((step + 1) / STEP_COUNT) * 100} className="h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            Step {step + 1} of {STEP_COUNT}
          </p>
        </header>

        <div className="flex flex-1 flex-col">
          {stepId === "name" && (
            <Step title="What should we call you?" subtitle="Your hero's name.">
              <div className="flex flex-col gap-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={data.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  placeholder="Iron Monk"
                  className="h-11"
                  autoFocus
                />
              </div>
            </Step>
          )}

          {stepId === "sex" && (
            <Step
              title="Biological sex"
              subtitle="Used for the Mifflin-St Jeor metabolic formula."
            >
              <div className="flex flex-col gap-3">
                {(["male", "female"] as const).map((s) => (
                  <OptionCard
                    key={s}
                    selected={data.sex === s}
                    title={s === "male" ? "Male" : "Female"}
                    onSelect={() => {
                      set("sex", s)
                      // Pre-select the matching character; the next step can change it.
                      set("avatarCharacter", resolveCharacter(s, null))
                    }}
                  />
                ))}
              </div>
            </Step>
          )}

          {stepId === "character" && (
            <Step
              title="Choose your character"
              subtitle="Just how your avatar looks — it doesn't affect your targets."
            >
              <div className="grid grid-cols-2 gap-3">
                {(["man", "woman"] as const).map((c) => {
                  const selected = data.avatarCharacter === c
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={c === "man" ? "Masculine figure" : "Feminine figure"}
                      onClick={() => set("avatarCharacter", c)}
                      className={
                        "flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 " +
                        (selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted")
                      }
                    >
                      <span className="flex h-24 w-16 items-center justify-center">
                        <Avatar level={0} character={c} className="h-full w-auto" />
                      </span>
                      <span className="text-sm font-medium">
                        {c === "man" ? "Masculine" : "Feminine"}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                You can change this any time from your profile.
              </p>
            </Step>
          )}

          {stepId === "dob" && (
            <Step title="Date of birth" subtitle="Age refines your calorie needs.">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={data.dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set("dob", e.target.value)}
                  className="h-11"
                />
              </div>
            </Step>
          )}

          {stepId === "body" && (
            <Step title="Body metrics" subtitle="Metric units (cm, kg).">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="heightCm">Height (cm)</Label>
                  <Input
                    id="heightCm"
                    type="number"
                    inputMode="decimal"
                    value={data.heightCm}
                    onChange={(e) => set("heightCm", e.target.value)}
                    placeholder="178"
                    className="h-11"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="weightKg">Weight (kg)</Label>
                  <Input
                    id="weightKg"
                    type="number"
                    inputMode="decimal"
                    value={data.weightKg}
                    onChange={(e) => set("weightKg", e.target.value)}
                    placeholder="80"
                    className="h-11"
                  />
                </div>
              </div>
            </Step>
          )}

          {stepId === "activity" && (
            <Step
              title="Activity level"
              subtitle="Your typical week, outside of IronQuest workouts."
            >
              <div className="flex flex-col gap-3">
                {ACTIVITY_LEVELS.map((a) => (
                  <OptionCard
                    key={a.value}
                    selected={data.activity === a.value}
                    title={a.label}
                    description={a.description}
                    onSelect={() => set("activity", a.value)}
                  />
                ))}
              </div>
            </Step>
          )}

          {stepId === "targets" && (
            <Step
              title="Your Cut targets"
              subtitle="Calculated for a ~17% deficit and 2 g/kg protein. Tweak if you like."
            >
              <div className="grid grid-cols-2 gap-4">
                <TargetField
                  id="calTarget"
                  label="Calories"
                  unit="kcal"
                  value={data.calTarget}
                  onChange={(v) => set("calTarget", v)}
                />
                <TargetField
                  id="proteinG"
                  label="Protein"
                  unit="g"
                  value={data.proteinG}
                  onChange={(v) => set("proteinG", v)}
                />
                <TargetField
                  id="carbsG"
                  label="Carbs"
                  unit="g"
                  value={data.carbsG}
                  onChange={(v) => set("carbsG", v)}
                />
                <TargetField
                  id="fatG"
                  label="Fat"
                  unit="g"
                  value={data.fatG}
                  onChange={(v) => set("fatG", v)}
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Phase: Cut. You can switch to Maintain or Build later in Settings.
              </p>
            </Step>
          )}

          {stepId === "discipline" && (
            <Step
              title="How do you train?"
              subtitle={`Pick where you start. A second discipline unlocks at level ${MULTICLASS_MIN_LEVEL}.`}
            >
              <DisciplineList
                options={disciplines}
                selectedSlug={data.disciplineSlug}
                onSelect={(slug) => set("disciplineSlug", slug)}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                {disciplines.filter((d) => canActivate(d.state)).length === 1
                  ? "Calisthenics is ready today — the rest are being built, and you'll be able to add one once you've levelled up."
                  : "You can add another discipline later from your profile."}
              </p>
            </Step>
          )}

          {stepId === "split" && (
            <Step
              title="Choose your split"
              subtitle="Sets your training days and rest days. You can customise it later."
            >
              <div className="flex flex-col gap-3">
                {SPLIT_TEMPLATES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={data.splitKey === s.key}
                    onClick={() => set("splitKey", s.key)}
                    className={
                      "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 " +
                      (data.splitKey === s.key
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted")
                    }
                  >
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {s.description}
                    </p>
                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {WEEKDAYS.map(({ key, label }) => {
                        const rest = s.days[key] === "Rest"
                        return (
                          <div key={key} className="text-center">
                            <div className="text-[10px] text-muted-foreground">
                              {label}
                            </div>
                            <div
                              className={
                                "mt-1 rounded-md px-1 py-1 text-[10px] leading-tight " +
                                (rest
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-primary/15 text-foreground")
                              }
                            >
                              {rest ? "—" : s.days[key]}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </button>
                ))}
              </div>
            </Step>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <footer className="mt-6 flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 flex-1"
              onClick={goBack}
              disabled={pending}
            >
              Back
            </Button>
          )}
          {isLast ? (
            <Button
              type="button"
              size="lg"
              className="h-11 flex-1"
              onClick={finish}
              disabled={!canAdvance || pending}
            >
              {pending ? "Saving…" : "Finish"}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-11 flex-1"
              onClick={goNext}
              disabled={!canAdvance}
            >
              Continue
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function TargetField({
  id,
  label,
  unit,
  value,
  onChange,
}: {
  id: string
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label} <span className="text-muted-foreground">({unit})</span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
      />
    </div>
  )
}
