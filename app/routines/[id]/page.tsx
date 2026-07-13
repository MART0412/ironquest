import { notFound, redirect } from "next/navigation"

import { RoutineEditor } from "@/components/routines/routine-editor"
import type { Weekday } from "@/lib/data/splits"
import { createClient } from "@/lib/supabase/server"

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: routine }, { data: exercises }] = await Promise.all([
    supabase
      .from("routines")
      .select(
        "id, name, day_of_week, routine_items(exercise_id, sets, reps_or_seconds, is_hold, sort_order, exercises(name))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("exercises")
      .select("id, slug, name, branch, tier, unlock_criteria")
      .order("branch")
      .order("tier"),
  ])

  // RLS returns null for other users' routines — indistinguishable from missing.
  if (!routine) notFound()

  const initial = {
    id: routine.id,
    name: routine.name,
    dayOfWeek: routine.day_of_week as Weekday[],
    items: [...routine.routine_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        exerciseId: item.exercise_id,
        exerciseName: item.exercises?.name ?? "Unknown exercise",
        sets: item.sets,
        repsOrSeconds: item.reps_or_seconds,
        isHold: item.is_hold,
      })),
  }

  return <RoutineEditor exercises={exercises ?? []} initial={initial} />
}
