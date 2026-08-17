"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import type { MilestoneAward } from "@/lib/game/equivalences"
import type { UnlockCriteria } from "@/lib/game/skills"
import { createClient } from "@/lib/supabase/server"

export type ActionError = { error: string }

/** A challenge offered by the engine after a workout. */
export type ChallengeOffer = {
  exercise_id: string
  slug: string
  name: string
  criteria: UnlockCriteria | null
  demo_notes: string | null
}

/** Result of attempting a challenge — `unlocks` feeds the existing celebration. */
export type AttemptResult = {
  unlocked: boolean
  exercise_id: string
  name: string
  workout_id: string
  unlocks: {
    exercise_id: string
    slug: string
    name: string
    xp: number
    cascaded: boolean
  }[]
  cascaded: number
  /** Milestones the attempt's own reps pushed past. */
  equivalences: MilestoneAward[]
}

const ATTEMPT_MESSAGES: Record<string, string> = {
  already_unlocked: "You've already unlocked that skill.",
  prerequisite_not_met:
    "That skill is further along its path — use fast-track to attempt it.",
  "exercise not challengeable": "That exercise has no unlock criteria.",
}

const attemptSchema = z.object({
  exerciseId: z.uuid(),
  sets: z.number().int().min(1).max(10),
  repsOrSeconds: z.number().int().min(1).max(600),
  isHold: z.boolean(),
  fastTrack: z.boolean().default(false),
})

export type AttemptInput = z.input<typeof attemptSchema>

/**
 * Log a challenge attempt. Unlocking is evidence-based: these sets are recorded
 * as workout evidence and the engine decides — there is no self-declaration.
 */
export async function attemptChallenge(
  input: AttemptInput
): Promise<ActionError | { result: AttemptResult }> {
  const parsed = attemptSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  const d = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const sets = Array.from({ length: d.sets }, (_, i) => ({
    set_no: i + 1,
    reps: d.isHold ? null : d.repsOrSeconds,
    seconds: d.isHold ? d.repsOrSeconds : null,
    rpe: null,
  }))

  const { data, error } = await supabase.rpc("attempt_challenge", {
    p_exercise_id: d.exerciseId,
    p_sets: sets,
    p_fast_track: d.fastTrack,
  })

  if (error) {
    const code = Object.keys(ATTEMPT_MESSAGES).find((k) => error.message.includes(k))
    return { error: code ? ATTEMPT_MESSAGES[code] : "Could not log the attempt." }
  }

  revalidatePath("/skills")
  revalidatePath("/")
  revalidatePath("/profile")
  return { result: data as unknown as AttemptResult }
}

/** Decline an offer: no award, but the node keeps its "Challenge Ready" badge. */
export async function declineChallenge(
  exerciseId: string
): Promise<ActionError | { ok: true }> {
  if (!z.uuid().safeParse(exerciseId).success) return { error: "Invalid skill." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { error } = await supabase.rpc("decline_challenge", {
    p_exercise_id: exerciseId,
  })
  if (error) return { error: "Could not save that." }

  revalidatePath("/skills")
  return { ok: true }
}
