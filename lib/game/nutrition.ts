// Pure nutrition-award rules (spec §2.1). Tested specification of the award
// logic inside the log_meal SQL function — keep both in lockstep, same as
// lib/game/streak.ts ↔ complete_workout.

/** ±5% tolerance band around the calorie target (spec §2.1). */
export const CALORIE_BAND = 0.05

/** "Log all meals for the day" proxy: 3+ entries in the MX day (user decision). */
export const ALL_MEALS_COUNT = 3

export const NUTRITION_XP = {
  protein_target: { xp: 40, points: 4 },
  calorie_target: { xp: 40, points: 4 },
  meals_logged: { xp: 20, points: 2 },
} as const

export type NutritionAction = keyof typeof NUTRITION_XP

export function proteinTargetHit(totalProteinG: number, targetG: number): boolean {
  return targetG > 0 && totalProteinG >= targetG
}

export function allMealsLogged(entryCount: number): boolean {
  return entryCount >= ALL_MEALS_COUNT
}

/** End-of-day condition: only meaningful for completed (past) days. */
export function withinCalorieBand(totalKcal: number, calTarget: number): boolean {
  return calTarget > 0 && Math.abs(totalKcal - calTarget) <= CALORIE_BAND * calTarget
}

export type NutritionAward = {
  action: NutritionAction
  baseXp: number
  points: number
}

/**
 * Awards that fire immediately on a meal log (both conditions are monotonic
 * within a day — protein can't be un-eaten, entries can't be un-counted).
 * The calorie band is NOT here: it's end-of-day, swept lazily for past days.
 */
export function immediateAwards(input: {
  dayProteinG: number
  dayEntryCount: number
  proteinTargetG: number
  alreadyAwarded: ReadonlySet<NutritionAction>
}): NutritionAward[] {
  const awards: NutritionAward[] = []

  if (
    proteinTargetHit(input.dayProteinG, input.proteinTargetG) &&
    !input.alreadyAwarded.has("protein_target")
  ) {
    awards.push({ action: "protein_target", baseXp: 40, points: 4 })
  }

  if (
    allMealsLogged(input.dayEntryCount) &&
    !input.alreadyAwarded.has("meals_logged")
  ) {
    awards.push({ action: "meals_logged", baseXp: 20, points: 2 })
  }

  return awards
}
