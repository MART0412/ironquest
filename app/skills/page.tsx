import { redirect } from "next/navigation"

import { SkillTreeView, type BestPerf } from "@/components/skills/skill-tree-view"
import { buildPathTracks, type PathInput } from "@/lib/game/paths"
import type { UnlockCriteria } from "@/lib/game/skills"
import { createClient } from "@/lib/supabase/server"

export default async function SkillsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: paths }, { data: unlocks }, { data: workouts }] =
    await Promise.all([
      // Paths with their ordered nodes (public read-only library).
      supabase
        .from("skill_paths")
        .select(
          "slug, name, display_order, signature_exercise_id, skill_path_nodes(position, exercises(id, slug, name, unlock_criteria, demo_notes))"
        )
        .order("display_order"),
      supabase.from("skill_unlocks").select("exercise_id, unlocked_at"),
      // RLS scopes workouts (and thus embedded sets) to the caller.
      supabase.from("workouts").select("workout_sets(exercise_id, reps, seconds)"),
    ])

  // Best logged performance per exercise, aggregated from the user's sets.
  const bestByExercise: Record<string, BestPerf> = {}
  for (const w of workouts ?? []) {
    for (const s of w.workout_sets ?? []) {
      const cur = bestByExercise[s.exercise_id] ?? { reps: null, seconds: null }
      bestByExercise[s.exercise_id] = {
        reps: maxNullable(cur.reps, s.reps),
        seconds: maxNullable(cur.seconds, s.seconds),
      }
    }
  }

  const pathInputs: PathInput[] = (paths ?? []).map((p) => ({
    slug: p.slug,
    name: p.name,
    signatureExerciseId: p.signature_exercise_id,
    nodes: (p.skill_path_nodes ?? [])
      .filter((n) => n.exercises !== null)
      .map((n) => ({
        position: n.position,
        exercise: {
          id: n.exercises!.id,
          slug: n.exercises!.slug ?? n.exercises!.id,
          name: n.exercises!.name,
          unlock_criteria: n.exercises!.unlock_criteria as UnlockCriteria | null,
          demo_notes: n.exercises!.demo_notes,
        },
      })),
  }))

  const tracks = buildPathTracks(pathInputs, unlocks ?? [])

  return <SkillTreeView tracks={tracks} bestByExercise={bestByExercise} />
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b
  if (b == null) return a
  return Math.max(a, b)
}
