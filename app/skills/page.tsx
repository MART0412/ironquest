import { redirect } from "next/navigation"

import {
  SkillTreeView,
  type BestPerf,
  type DisciplineGroup,
} from "@/components/skills/skill-tree-view"
import { metaFor } from "@/lib/game/disciplines"
import { buildPathTracks, type PathInput } from "@/lib/game/paths"
import type { UnlockCriteria } from "@/lib/game/skills"
import { createClient } from "@/lib/supabase/server"

export default async function SkillsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: paths },
    { data: unlocks },
    { data: workouts },
    { data: chals },
    { data: mine },
  ] = await Promise.all([
    // Paths with their ordered nodes (public read-only library).
    supabase
      .from("skill_paths")
      .select(
        "slug, name, display_order, signature_exercise_id, disciplines!inner(slug, name), skill_path_nodes(position, exercises(id, slug, name, unlock_criteria, demo_notes))"
      )
      .order("display_order"),
    supabase.from("skill_unlocks").select("exercise_id, unlocked_at"),
    // RLS scopes workouts (and thus embedded sets) to the caller.
    supabase.from("workouts").select("workout_sets(exercise_id, reps, seconds)"),
    supabase.from("skill_challenges").select("exercise_id, status"),
    supabase
      .from("user_disciplines")
      .select("activated_at, disciplines!inner(slug, name, display_order)")
      .order("activated_at"),
  ])

  // Challenge state per exercise, so locked nodes can badge "Challenge Ready".
  const challengeByExercise = new Map(
    (chals ?? []).map((c) => [c.exercise_id, c.status])
  )

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
          challengeStatus: challengeByExercise.get(n.exercises!.id) ?? null,
        },
      })),
  }))

  const tracks = buildPathTracks(pathInputs, unlocks ?? [])
  const trackByPath = new Map(tracks.map((track) => [track.key, track]))

  // One group per ACTIVATED discipline, in the order they were taken up. A
  // discipline with no library yet still gets its section, so activating it
  // visibly means something.
  // Falling back to calisthenics keeps the tree from blanking out if a row is
  // ever missing — it is what every pre-Phase-3 account trains anyway.
  const activated = (mine ?? []).map((row) => row.disciplines!)
  if (activated.length === 0) {
    activated.push({ slug: "calisthenics", name: "Calisthenics", display_order: 1 })
  }
  const groups: DisciplineGroup[] = activated.map((discipline) => ({
    slug: discipline.slug,
    name: discipline.name,
    hasLibrary: metaFor(discipline.slug).hasLibrary,
    hasActivityLogging: metaFor(discipline.slug).hasActivityLogging,
    tracks: (paths ?? [])
      .filter((p) => p.disciplines?.slug === discipline.slug)
      .map((p) => trackByPath.get(p.slug))
      .filter((track): track is NonNullable<typeof track> => !!track),
  }))

  return <SkillTreeView groups={groups} bestByExercise={bestByExercise} />
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b
  if (b == null) return a
  return Math.max(a, b)
}
