// Server-side glue between the pure engine (lib/fitness/adaptation.ts) and the
// user's data. Not a server action: it takes an existing Supabase client and is
// called from lib/actions/workouts.ts right after a workout is completed.

import {
  ADAPTATION,
  evaluateAdaptation,
  suppressedByDismissal,
  type AdaptationKind,
  type Difficulty,
  type SessionFeedback,
} from "@/lib/fitness/adaptation"
import type { Database } from "@/lib/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

/** A proposal surfaced on the completion screen — never applied on its own. */
export type AdaptationProposal = {
  routineItemId: string
  exerciseId: string
  exerciseName: string
  kind: AdaptationKind
  reason: string
  current: { sets: number; repsOrSeconds: number; isHold: boolean }
  /** Null for next_progression, which changes no numbers. */
  proposal: { sets: number; repsOrSeconds: number } | null
}

type Client = SupabaseClient<Database>

/**
 * Evaluate the exercises just logged and return any volume proposals.
 *
 * Read-only: it looks at recent sessions' difficulty signals and the routine's
 * current prescription, and hands the user something to accept or dismiss.
 */
export async function proposeAdaptations(
  supabase: Client,
  routineItemIds: string[]
): Promise<AdaptationProposal[]> {
  if (routineItemIds.length === 0) return []

  const { data: items } = await supabase
    .from("routine_items")
    .select("id, exercise_id, sets, reps_or_seconds, is_hold, exercises(name)")
    .in("id", routineItemIds)

  if (!items || items.length === 0) return []

  const exerciseIds = [...new Set(items.map((i) => i.exercise_id))]

  // Recent sessions, newest first. Bounded by how many sessions the engine can
  // possibly need (WINDOW per exercise) with headroom for mixed routines.
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, date, created_at, workout_sets(exercise_id, difficulty)")
    .eq("status", "completed")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(ADAPTATION.WINDOW * 10)

  const { data: dismissals } = await supabase
    .from("prescription_adjustments")
    .select("routine_item_id, kind, from_sets, from_reps")
    .eq("outcome", "dismissed")
    .in("routine_item_id", routineItemIds)

  const proposals: AdaptationProposal[] = []

  for (const item of items) {
    // Chronological (oldest first) sessions that actually trained this exercise.
    const sessions: SessionFeedback[] = (workouts ?? [])
      .map((w) => ({
        at: w.created_at,
        difficulties: (w.workout_sets ?? [])
          .filter((s) => s.exercise_id === item.exercise_id)
          .map((s) => (s.difficulty as Difficulty | null) ?? null),
      }))
      .filter((s) => s.difficulties.length > 0)
      .reverse()
      .slice(-ADAPTATION.WINDOW)

    const prescription = {
      sets: item.sets,
      repsOrSeconds: item.reps_or_seconds,
      isHold: item.is_hold,
    }

    const result = evaluateAdaptation({ sessions, prescription })

    const dismissed = (dismissals ?? [])
      .filter((d) => d.routine_item_id === item.id)
      .map((d) => ({
        kind: d.kind as AdaptationKind,
        fromSets: d.from_sets,
        fromReps: d.from_reps,
      }))

    if (suppressedByDismissal(result.kind, prescription, dismissed)) continue

    proposals.push({
      routineItemId: item.id,
      exerciseId: item.exercise_id,
      exerciseName: item.exercises?.name ?? "This exercise",
      kind: result.kind as AdaptationKind,
      reason: result.reason,
      current: prescription,
      proposal: result.proposal
        ? {
            sets: result.proposal.sets,
            repsOrSeconds: result.proposal.repsOrSeconds,
          }
        : null,
    })
  }

  return proposals
}
