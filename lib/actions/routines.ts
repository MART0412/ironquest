"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import * as z from "zod"

import { getSplit, type SplitKey, SPLIT_KEYS } from "@/lib/data/splits"
import { createSplitRoutines } from "@/lib/routines/create-split-routines"
import { createClient } from "@/lib/supabase/server"
import {
  saveRoutineSchema,
  type SaveRoutineInput,
} from "@/lib/validations/routines"

export type ActionError = { error: string }

/** Creates or updates a routine (atomic via the save_routine RPC), then returns to the list. */
export async function saveRoutine(
  input: SaveRoutineInput
): Promise<ActionError> {
  const parsed = saveRoutineSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const d = parsed.data
  const { error } = await supabase.rpc("save_routine", {
    p_name: d.name,
    p_day_of_week: d.dayOfWeek,
    p_items: d.items.map((i) => ({
      exercise_id: i.exerciseId,
      sets: i.sets,
      reps_or_seconds: i.repsOrSeconds,
      is_hold: i.isHold,
    })),
    ...(d.id ? { p_id: d.id } : {}),
  })

  if (error) {
    return { error: "Could not save the routine. Please try again." }
  }

  revalidatePath("/routines")
  redirect("/routines")
}

export async function deleteRoutine(id: string): Promise<ActionError> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid routine." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { error } = await supabase.from("routines").delete().eq("id", id)
  if (error) {
    return { error: "Could not delete the routine. Please try again." }
  }

  revalidatePath("/routines")
  redirect("/routines")
}

/** One-tap template: create the split's routines and declare it as the active split. */
export async function applySplitTemplate(
  splitKey: SplitKey
): Promise<ActionError | { created: number }> {
  if (!SPLIT_KEYS.includes(splitKey)) return { error: "Unknown split." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const result = await createSplitRoutines(supabase, splitKey)
  if ("error" in result) return result

  // The routines define the split — keep the profile's declared split in sync.
  const split = getSplit(splitKey)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ split_config: split ? { ...split } : { key: splitKey } })
    .eq("id", user.id)
  if (profileError) {
    return { error: "Routines created, but the split could not be saved." }
  }

  revalidatePath("/routines")
  revalidatePath("/")
  return result
}
