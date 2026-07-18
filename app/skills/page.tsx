import { redirect } from "next/navigation"

import { SkillTreeView, type BestPerf } from "@/components/skills/skill-tree-view"
import { buildTree, type ExerciseNode } from "@/lib/game/skill-tree"
import type { UnlockCriteria } from "@/lib/game/skills"
import { createClient } from "@/lib/supabase/server"

export default async function SkillsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: exercises }, { data: unlocks }, { data: workouts }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select("id, slug, name, branch, tier, unlock_criteria, demo_notes")
        .not("unlock_criteria", "is", null)
        .order("branch")
        .order("tier"),
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

  const treeExercises: ExerciseNode[] = (exercises ?? []).map((e) => ({
    id: e.id,
    slug: e.slug ?? e.id,
    name: e.name,
    branch: e.branch as ExerciseNode["branch"],
    tier: e.tier,
    unlock_criteria: e.unlock_criteria as UnlockCriteria | null,
    demo_notes: e.demo_notes,
  }))

  const { nodes, edges, width, height } = buildTree(treeExercises, unlocks ?? [])

  return (
    <SkillTreeView
      nodes={nodes}
      edges={edges}
      width={width}
      height={height}
      bestByExercise={bestByExercise}
    />
  )
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b
  if (b == null) return a
  return Math.max(a, b)
}
