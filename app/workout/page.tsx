import { redirect } from "next/navigation"

import { WorkoutCheckoff } from "@/components/workout/checkoff"
import { mxDateOf, weekdayOf } from "@/lib/game/streak"
import { createClient } from "@/lib/supabase/server"

export default async function WorkoutPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today = mxDateOf(new Date())
  const todayWeekday = weekdayOf(today)

  const [{ data: profile }, { data: routines }, { data: todayWorkouts }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("routines")
        .select(
          "id, name, day_of_week, routine_items(exercise_id, sets, reps_or_seconds, is_hold, sort_order, exercises(name))"
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("workouts")
        .select("routine_id")
        .eq("date", today)
        .eq("status", "completed"),
    ])

  if (!profile?.onboarding_completed_at) redirect("/onboarding")

  const toCheckoffRoutine = (r: NonNullable<typeof routines>[number]) => ({
    id: r.id,
    name: r.name,
    items: [...r.routine_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        exerciseId: item.exercise_id,
        exerciseName: item.exercises?.name ?? "Unknown exercise",
        sets: item.sets,
        repsOrSeconds: item.reps_or_seconds,
        isHold: item.is_hold,
      })),
  })

  const all = routines ?? []
  const scheduled = all
    .filter((r) => r.day_of_week.includes(todayWeekday))
    .map(toCheckoffRoutine)
  const others = all
    .filter((r) => !r.day_of_week.includes(todayWeekday))
    .map(toCheckoffRoutine)

  const completedRoutineIds = (todayWorkouts ?? [])
    .map((w) => w.routine_id)
    .filter((id): id is string => id !== null)

  return (
    <WorkoutCheckoff
      scheduled={scheduled}
      others={others}
      completedRoutineIds={completedRoutineIds}
      todayWeekday={todayWeekday}
    />
  )
}
