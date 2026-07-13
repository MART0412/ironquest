import { ROUTINE_TEMPLATES } from "@/lib/data/routine-templates"
import type { SplitKey } from "@/lib/data/splits"
import type { createClient } from "@/lib/supabase/server"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type CreateSplitResult = { created: number } | { error: string }

/**
 * Creates the template routines for a split via the atomic save_routine RPC.
 * Name-idempotent: template routines whose name the user already has are
 * skipped, so onboarding retries and repeated one-taps never duplicate.
 * Only used from server actions; RLS scopes every read/write to the caller.
 */
export async function createSplitRoutines(
  supabase: ServerClient,
  splitKey: SplitKey
): Promise<CreateSplitResult> {
  const templates = ROUTINE_TEMPLATES[splitKey]

  const { data: existing, error: existingError } = await supabase
    .from("routines")
    .select("name")
  if (existingError) {
    return { error: "Could not load your routines. Please try again." }
  }

  const have = new Set(existing.map((r) => r.name))
  const pending = templates.filter((t) => !have.has(t.name))
  if (pending.length === 0) return { created: 0 }

  const slugs = [...new Set(pending.flatMap((t) => t.items.map((i) => i.slug)))]
  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id, slug")
    .in("slug", slugs)
  if (exercisesError) {
    return { error: "Could not load the exercise library. Please try again." }
  }

  const idBySlug = new Map(exercises.map((e) => [e.slug, e.id]))
  const missing = slugs.filter((s) => !idBySlug.has(s))
  if (missing.length > 0) {
    // Template/seed drift — should be caught by the template integrity test.
    return { error: `Exercise library is missing: ${missing.join(", ")}` }
  }

  for (const t of pending) {
    const { error: rpcError } = await supabase.rpc("save_routine", {
      p_name: t.name,
      p_day_of_week: t.days,
      p_items: t.items.map((i) => ({
        exercise_id: idBySlug.get(i.slug)!,
        sets: i.sets,
        reps_or_seconds: i.repsOrSeconds,
        is_hold: i.isHold ?? false,
      })),
    })
    if (rpcError) {
      return { error: "Could not create your routines. Please try again." }
    }
  }

  return { created: pending.length }
}
