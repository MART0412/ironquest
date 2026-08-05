"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { createClient } from "@/lib/supabase/server"

const decisionSchema = z.object({
  routineItemId: z.uuid(),
  exerciseId: z.uuid(),
  kind: z.enum(["increment", "hold", "deload", "next_progression"]),
  outcome: z.enum(["accepted", "dismissed"]),
  fromSets: z.number().int().min(1).max(10),
  fromReps: z.number().int().min(1).max(600),
  toSets: z.number().int().min(1).max(10).nullish(),
  toReps: z.number().int().min(1).max(600).nullish(),
})

export type AdaptationDecisionInput = z.input<typeof decisionSchema>

/**
 * Record the user's decision — and, only when accepted with new numbers, write
 * them onto the routine. Every decision is logged either way, so the
 * prescription's history is auditable.
 */
export async function decideAdaptation(
  input: AdaptationDecisionInput
): Promise<{ error: string } | { ok: true }> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid adjustment." }
  const d = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const applies =
    d.outcome === "accepted" &&
    d.toSets != null &&
    d.toReps != null &&
    (d.toSets !== d.fromSets || d.toReps !== d.fromReps)

  if (applies) {
    // RLS scopes routine_items through the owning routine, so a foreign id
    // simply matches nothing.
    const { error } = await supabase
      .from("routine_items")
      .update({ sets: d.toSets!, reps_or_seconds: d.toReps! })
      .eq("id", d.routineItemId)
    if (error) return { error: "Could not update your routine." }
  }

  const { error: logError } = await supabase
    .from("prescription_adjustments")
    .insert({
      user_id: user.id,
      routine_item_id: d.routineItemId,
      exercise_id: d.exerciseId,
      kind: d.kind,
      outcome: d.outcome,
      from_sets: d.fromSets,
      from_reps: d.fromReps,
      to_sets: d.toSets ?? null,
      to_reps: d.toReps ?? null,
    })
  if (logError) return { error: "Could not save that adjustment." }

  revalidatePath("/routines")
  revalidatePath("/workout")
  return { ok: true }
}
