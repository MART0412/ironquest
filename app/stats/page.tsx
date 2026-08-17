import { redirect } from "next/navigation"

import { LifetimeView } from "@/components/stats/lifetime-view"
import {
  aggregateLifetime,
  DEFAULT_BODYWEIGHT_KG,
  type LifetimeSet,
  type MovementFamily,
} from "@/lib/game/equivalences"
import { MX_TZ } from "@/lib/game/streak"
import { createClient } from "@/lib/supabase/server"

const dateFmt = new Intl.DateTimeFormat("en", {
  timeZone: MX_TZ,
  month: "short",
  day: "numeric",
})

export default async function StatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profile }, { data: workouts }, { data: earned }] =
    await Promise.all([
      supabase.from("profiles").select("weight_kg").eq("id", user.id).maybeSingle(),
      // RLS scopes workouts (and their embedded sets) to the caller. Totals are
      // aggregated with the same pure function the engine's SQL mirrors.
      supabase
        .from("workouts")
        .select("id, workout_sets(reps, seconds, exercises(movement_family))")
        .eq("status", "completed"),
      supabase.from("user_milestones").select("milestone_id, awarded_at"),
    ])

  const sets: LifetimeSet[] = (workouts ?? []).flatMap((workout) =>
    (workout.workout_sets ?? []).map((set) => ({
      family: (set.exercises?.movement_family as MovementFamily | null) ?? null,
      reps: set.reps,
      seconds: set.seconds,
    }))
  )

  const totals = aggregateLifetime({ sets, workouts: (workouts ?? []).length })

  const earnedAt = Object.fromEntries(
    (earned ?? []).map((row) => [
      row.milestone_id,
      dateFmt.format(new Date(row.awarded_at)),
    ])
  )

  return (
    <LifetimeView
      totals={totals}
      ctx={{ bodyweightKg: profile?.weight_kg ?? DEFAULT_BODYWEIGHT_KG }}
      earnedAt={earnedAt}
    />
  )
}
