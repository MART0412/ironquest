"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import type { Database } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/server"
import {
  manualMealSchema,
  relogSchema,
  type ManualMealInput,
  type RelogInput,
} from "@/lib/validations/nutrition"

type LogMealArgs = Database["public"]["Functions"]["log_meal"]["Args"]

export type MealAward = {
  action: "protein_target" | "meals_logged" | "calorie_target"
  xp: number
  points: number
  for_day?: string
}

/** Shape of the jsonb returned by the log_meal engine. */
export type LogMealResult = {
  meal_log_id: string
  awards: MealAward[]
  streak_len: number
  multiplier: number
  milestones: number
  day: { kcal: number; protein: number; carbs: number; fat: number; count: number }
}

type LogMealResponse = { error: string } | { result: LogMealResult }

async function callLogMeal(args: LogMealArgs): Promise<LogMealResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { data, error } = await supabase.rpc("log_meal", args)
  if (error) {
    return { error: "Could not log the meal. Please try again." }
  }

  revalidatePath("/")
  revalidatePath("/nutrition")
  return { result: data as unknown as LogMealResult }
}

export async function logManualMeal(
  input: ManualMealInput
): Promise<LogMealResponse> {
  const parsed = manualMealSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  const d = parsed.data
  return callLogMeal({
    p_name: d.name,
    p_kcal: d.kcal,
    p_protein: d.protein,
    p_carbs: d.carbs,
    p_fat: d.fat,
    ...(d.serving ? { p_serving: d.serving } : {}),
    p_save: d.save,
  })
}

export async function relogFood(input: RelogInput): Promise<LogMealResponse> {
  const parsed = relogSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid food." }
  return callLogMeal({ p_food_id: parsed.data.foodId })
}

export async function deleteMealLog(
  id: string
): Promise<{ error: string } | { ok: true }> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid entry." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  // RLS scopes the delete to the caller's own rows. Awards already granted
  // stand — the ledger is append-only (noted v1 behavior).
  const { error } = await supabase.from("meal_logs").delete().eq("id", id)
  if (error) return { error: "Could not remove the entry." }

  revalidatePath("/")
  revalidatePath("/nutrition")
  return { ok: true }
}
