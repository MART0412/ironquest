"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import {
  completeWorkoutSchema,
  type CompleteWorkoutInput,
} from "@/lib/validations/workouts"

/** Shape of the jsonb returned by the complete_workout engine. */
export type CompleteWorkoutResult = {
  workout_id: string
  action: "scheduled_workout" | "bonus_workout" | "capped"
  xp: number
  points: number
  streak_len: number
  multiplier: number
  milestones: number
  reset: boolean
}

export async function completeWorkout(
  input: CompleteWorkoutInput
): Promise<{ error: string } | { result: CompleteWorkoutResult }> {
  const parsed = completeWorkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  // Expand checked exercises into per-set rows for the engine.
  const sets = parsed.data.items.flatMap((item) =>
    Array.from({ length: item.sets }, (_, i) => ({
      exercise_id: item.exerciseId,
      set_no: i + 1,
      reps: item.isHold ? null : item.repsOrSeconds,
      seconds: item.isHold ? item.repsOrSeconds : null,
      rpe: null,
    }))
  )

  const { data, error } = await supabase.rpc("complete_workout", {
    p_routine_id: parsed.data.routineId,
    p_sets: sets,
  })

  if (error) {
    return { error: "Could not complete the workout. Please try again." }
  }

  revalidatePath("/")
  revalidatePath("/workout")
  return { result: data as unknown as CompleteWorkoutResult }
}
