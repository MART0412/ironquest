import { redirect } from "next/navigation"

import {
  NutritionView,
  type LibraryFood,
  type TimelineEntry,
} from "@/components/nutrition/nutrition-view"
import { mxDateOf, MX_TZ } from "@/lib/game/streak"
import { createClient } from "@/lib/supabase/server"

const timeFormat = new Intl.DateTimeFormat("en", {
  timeZone: MX_TZ,
  hour: "2-digit",
  minute: "2-digit",
})

export default async function NutritionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today = mxDateOf(new Date())
  const window48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const window30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: profile },
    { data: recentLogs },
    { data: monthLogs },
    { data: myFoods },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("onboarding_completed_at, cal_target, protein_g, carbs_g, fat_g")
      .eq("id", user.id)
      .maybeSingle(),
    // 48h window covers all of "today" in Mexico City without hardcoding the
    // UTC offset; exact day filtering happens below via mxDateOf.
    supabase
      .from("meal_logs")
      .select("id, ts, kcal, protein_g, carbs_g, fat_g, foods(name, serving)")
      .gte("ts", window48h)
      .order("ts", { ascending: false }),
    supabase
      .from("meal_logs")
      .select(
        "food_id, ts, foods(id, name, kcal, protein_g, carbs_g, fat_g, serving, source)"
      )
      .gte("ts", window30d)
      .not("food_id", "is", null),
    supabase
      .from("foods")
      .select("id, name, kcal, protein_g, carbs_g, fat_g, serving")
      .eq("user_id", user.id)
      .eq("source", "custom")
      .order("name"),
  ])

  if (!profile?.onboarding_completed_at) redirect("/onboarding")

  const todayEntries: TimelineEntry[] = (recentLogs ?? [])
    .filter((log) => mxDateOf(new Date(log.ts)) === today)
    .map((log) => ({
      id: log.id,
      time: timeFormat.format(new Date(log.ts)),
      name: log.foods?.name ?? "Entry",
      serving: log.foods?.serving ?? null,
      kcal: Number(log.kcal),
      protein: Number(log.protein_g),
      carbs: Number(log.carbs_g),
      fat: Number(log.fat_g),
    }))

  const consumed = todayEntries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )

  // Recent = distinct foods by latest log; Frequent = by 30-day log count.
  const toLibrary = (f: {
    id: string
    name: string
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    serving: string | null
  }): LibraryFood => ({
    id: f.id,
    name: f.name,
    kcal: Number(f.kcal),
    protein: Number(f.protein_g),
    carbs: Number(f.carbs_g),
    fat: Number(f.fat_g),
    serving: f.serving,
  })

  const latestByFood = new Map<string, { ts: string; food: LibraryFood }>()
  const countByFood = new Map<string, number>()
  for (const log of monthLogs ?? []) {
    if (!log.food_id || !log.foods) continue
    countByFood.set(log.food_id, (countByFood.get(log.food_id) ?? 0) + 1)
    const prev = latestByFood.get(log.food_id)
    if (!prev || log.ts > prev.ts) {
      latestByFood.set(log.food_id, { ts: log.ts, food: toLibrary(log.foods) })
    }
  }

  const recent = [...latestByFood.values()]
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 8)
    .map((x) => x.food)

  const frequent = [...countByFood.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([foodId]) => latestByFood.get(foodId)?.food)
    .filter((f): f is LibraryFood => !!f)

  return (
    <NutritionView
      targets={{
        calTarget: profile.cal_target ?? 0,
        proteinG: profile.protein_g ?? 0,
        carbsG: profile.carbs_g ?? 0,
        fatG: profile.fat_g ?? 0,
      }}
      consumed={consumed}
      entries={todayEntries}
      myFoods={(myFoods ?? []).map(toLibrary)}
      recent={recent}
      frequent={frequent}
    />
  )
}
