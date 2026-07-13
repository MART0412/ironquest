// Pure nutrition math: Mifflin-St Jeor BMR -> TDEE -> Cut-phase targets.
// No side effects, so this stays unit-testable (see Slice 4 test plan).

export type Sex = "male" | "female"

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very"
  | "extra"

export const ACTIVITY_LEVELS: {
  value: ActivityLevel
  label: string
  description: string
  factor: number
}[] = [
  {
    value: "sedentary",
    label: "Sedentary",
    description: "Little or no exercise, desk job",
    factor: 1.2,
  },
  {
    value: "light",
    label: "Lightly active",
    description: "Light exercise 1–3 days/week",
    factor: 1.375,
  },
  {
    value: "moderate",
    label: "Moderately active",
    description: "Moderate exercise 3–5 days/week",
    factor: 1.55,
  },
  {
    value: "very",
    label: "Very active",
    description: "Hard exercise 6–7 days/week",
    factor: 1.725,
  },
  {
    value: "extra",
    label: "Extra active",
    description: "Physical job or training twice a day",
    factor: 1.9,
  },
]

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((l) => l.value === level)?.factor ?? 1.2
}

/** Whole years between `dob` and `now` (defaults to today). */
export function ageFromDob(dob: string | Date, now: Date = new Date()): number {
  const birth = typeof dob === "string" ? new Date(dob) : dob
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function mifflinBmr(input: {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
}): number {
  const { sex, weightKg, heightCm, age } = input
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return base + (sex === "male" ? 5 : -161)
}

export type NutritionTargets = {
  calTarget: number
  proteinG: number
  carbsG: number
  fatG: number
}

/** Cut-phase deficit applied to TDEE (spec §5.1: ~15–20%; we use 17%). */
export const CUT_DEFICIT = 0.17

/**
 * Cut-phase targets from body metrics:
 * - calories = TDEE * (1 - deficit)
 * - protein  = 2 g/kg bodyweight
 * - fat      = 25% of target calories
 * - carbs    = remaining calories
 */
export function cutTargets(input: {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
  activity: ActivityLevel
}): NutritionTargets {
  const { sex, weightKg, heightCm, age, activity } = input
  const bmr = mifflinBmr({ sex, weightKg, heightCm, age })
  const tdee = bmr * activityFactor(activity)
  const calTarget = Math.round(tdee * (1 - CUT_DEFICIT))

  const proteinG = Math.round(2 * weightKg)
  const fatG = Math.round((calTarget * 0.25) / 9)
  const carbsG = Math.max(
    0,
    Math.round((calTarget - proteinG * 4 - fatG * 9) / 4)
  )

  return { calTarget, proteinG, carbsG, fatG }
}
