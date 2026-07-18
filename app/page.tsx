import Link from "next/link"
import { redirect } from "next/navigation"

import { CharacterHeader } from "@/components/home/character-header"
import { MacroRings } from "@/components/home/macro-rings"
import { QuestCard, type QuestRoutine } from "@/components/home/quest-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { signOut } from "@/lib/actions/auth"
import { multiplierFor, mxDateOf, weekdayOf } from "@/lib/game/streak"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today = mxDateOf(new Date())
  const todayWeekday = weekdayOf(today)

  const window48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [
    { data: profile },
    { data: ledger },
    { data: streak },
    { data: routines },
    { data: todayWorkouts },
    { data: recentMeals },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("xp_ledger").select("xp, points"),
    supabase
      .from("streaks")
      .select("current_len, best_len")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("routines").select("id, name, day_of_week, routine_items(id)"),
    supabase
      .from("workouts")
      .select("routine_id")
      .eq("date", today)
      .eq("status", "completed"),
    // 48h window covers all of MX-today; exact filtering below via mxDateOf.
    supabase
      .from("meal_logs")
      .select("ts, kcal, protein_g, carbs_g, fat_g")
      .gte("ts", window48h),
  ])

  if (!profile?.onboarding_completed_at) redirect("/onboarding")

  const totalXp = (ledger ?? []).reduce((sum, row) => sum + row.xp, 0)
  const totalPoints = (ledger ?? []).reduce((sum, row) => sum + row.points, 0)
  const streakLen = streak?.current_len ?? 0
  const bestLen = streak?.best_len ?? 0

  const consumed = (recentMeals ?? [])
    .filter((m) => mxDateOf(new Date(m.ts)) === today)
    .reduce(
      (acc, m) => ({
        kcal: acc.kcal + Number(m.kcal),
        protein: acc.protein + Number(m.protein_g),
        carbs: acc.carbs + Number(m.carbs_g),
        fat: acc.fat + Number(m.fat_g),
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    )
  const consumedRounded = {
    kcal: Math.round(consumed.kcal),
    protein: Math.round(consumed.protein),
    carbs: Math.round(consumed.carbs),
    fat: Math.round(consumed.fat),
  }

  const completedRoutineIds = new Set(
    (todayWorkouts ?? []).map((w) => w.routine_id).filter(Boolean)
  )
  const questRoutines: QuestRoutine[] = (routines ?? [])
    .filter((r) => r.day_of_week.includes(todayWeekday))
    .map((r) => ({
      id: r.id,
      name: r.name,
      itemCount: r.routine_items.length,
      done: completedRoutineIds.has(r.id),
    }))

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <CharacterHeader
        displayName={profile.display_name ?? "Hero"}
        totalXp={totalXp}
      />

      {/* Streak / points / phase chips */}
      <section className="flex flex-wrap gap-2 text-xs" aria-label="Stats">
        <span className="rounded-full bg-muted px-3 py-1.5 font-medium">
          🔥 {streakLen}-day streak
          {streakLen > 0 && (
            <span className="text-muted-foreground">
              {" "}
              ×{multiplierFor(streakLen).toFixed(2)}
            </span>
          )}
        </span>
        <span className="rounded-full bg-muted px-3 py-1.5">
          Best {bestLen}
        </span>
        <span className="rounded-full bg-muted px-3 py-1.5">
          {totalPoints} pts
        </span>
        <span className="rounded-full bg-muted px-3 py-1.5 capitalize">
          {profile.phase}
        </span>
      </section>

      <QuestCard routines={questRoutines} isRestDay={questRoutines.length === 0} />

      <Card>
        <CardHeader>
          <CardTitle>Daily macros</CardTitle>
        </CardHeader>
        <CardContent>
          <MacroRings
            calTarget={profile.cal_target ?? 0}
            proteinG={profile.protein_g ?? 0}
            carbsG={profile.carbs_g ?? 0}
            fatG={profile.fat_g ?? 0}
            consumed={consumedRounded}
          />
        </CardContent>
      </Card>

      {/* Quick-log row (spec §7.1) */}
      <section className="grid grid-cols-2 gap-3" aria-label="Quick log">
        <Link href="/workout" className={buttonVariants({ size: "lg" })}>
          Log workout
        </Link>
        <Link
          href="/nutrition"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Log meal
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3" aria-label="Explore">
        <Link
          href="/skills"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Skill tree
        </Link>
        <Link
          href="/profile"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Profile
        </Link>
      </section>

      <footer className="mt-auto flex items-center justify-between border-t border-border pt-4">
        <Link
          href="/routines"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Manage routines
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </footer>
    </main>
  )
}
