import Link from "next/link"
import { redirect } from "next/navigation"

import { StatRadar } from "@/components/profile/stat-radar"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { levelFromXp } from "@/lib/game/level"
import { BRANCH_ORDER, type BranchKey } from "@/lib/game/skill-tree"
import { computeStats } from "@/lib/game/stats"
import { createClient } from "@/lib/supabase/server"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profile }, { data: ledger }, { data: exercises }, { data: unlocks }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.from("xp_ledger").select("xp"),
      supabase.from("exercises").select("id, branch, tier").not("unlock_criteria", "is", null),
      supabase.from("skill_unlocks").select("exercise_id"),
    ])

  const totalXp = (ledger ?? []).reduce((sum, r) => sum + r.xp, 0)
  const { level } = levelFromXp(totalXp)

  // Max tier per branch (from the library) + unlocked tiers per branch (this user).
  const maxTierByBranch = emptyBranchMap(0)
  const tierByExercise = new Map<string, { branch: BranchKey; tier: number }>()
  for (const e of exercises ?? []) {
    const branch = e.branch as BranchKey
    if (!(branch in maxTierByBranch)) continue
    tierByExercise.set(e.id, { branch, tier: e.tier })
    if (e.tier > maxTierByBranch[branch]) maxTierByBranch[branch] = e.tier
  }

  const unlockedTiersByBranch = emptyBranchMap<number[]>([])
  for (const key of BRANCH_ORDER) unlockedTiersByBranch[key] = []
  let unlockedCount = 0
  for (const u of unlocks ?? []) {
    const meta = tierByExercise.get(u.exercise_id)
    if (!meta) continue
    unlockedTiersByBranch[meta.branch].push(meta.tier)
    unlockedCount++
  }

  const stats = computeStats(unlockedTiersByBranch, maxTierByBranch)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Home
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-semibold">
            {profile?.display_name ?? "Hero"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Level {level} · {unlockedCount} skill{unlockedCount === 1 ? "" : "s"} unlocked
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <StatRadar stats={stats} />
        </CardContent>
      </Card>

      <Link href="/skills" className={buttonVariants({ variant: "outline", size: "lg" })}>
        View skill tree
      </Link>
    </main>
  )
}

function emptyBranchMap<T>(fill: T): Record<BranchKey, T> {
  return {
    push: fill,
    pull: fill,
    core: fill,
    legs: fill,
    static: fill,
  }
}
