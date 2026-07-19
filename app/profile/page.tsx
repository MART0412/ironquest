import type { CSSProperties } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { Avatar } from "@/components/profile/avatar"
import { StatRadar } from "@/components/profile/stat-radar"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { levelFromXp } from "@/lib/game/level"
import { BRANCH_ORDER, type BranchKey } from "@/lib/game/skill-tree"
import { computeStats } from "@/lib/game/stats"
import { createClient } from "@/lib/supabase/server"

type CosmeticMeta = { accent?: string; slot?: string }

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: profile },
    { data: ledger },
    { data: exercises },
    { data: unlocks },
    { data: equipped },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("xp_ledger").select("xp"),
    supabase.from("exercises").select("id, branch, tier").not("unlock_criteria", "is", null),
    supabase.from("skill_unlocks").select("exercise_id"),
    // Equipped cosmetics with their catalog metadata (title/theme/gear).
    supabase
      .from("cosmetic_equipped")
      .select("cosmetics!inner(name, type, metadata)"),
  ])

  const totalXp = (ledger ?? []).reduce((sum, r) => sum + r.xp, 0)
  const { level } = levelFromXp(totalXp)

  // Equipped cosmetics → title text, theme accent, gear slots.
  let equippedTitle: string | null = null
  let themeAccent: string | null = null
  const gearSlots: string[] = []
  for (const row of equipped ?? []) {
    const c = row.cosmetics
    if (!c) continue
    const meta = (c.metadata ?? {}) as CosmeticMeta
    if (c.type === "title") equippedTitle = c.name
    else if (c.type === "theme" && meta.accent) themeAccent = meta.accent
    else if (c.type === "gear" && meta.slot) gearSlots.push(meta.slot)
  }

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

  // An equipped theme overrides --primary for the whole page (radar, avatar accent, title).
  const themeStyle = themeAccent
    ? ({ "--primary": themeAccent } as CSSProperties)
    : undefined

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8"
      style={themeStyle}
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <Link
          href="/"
          className="self-start text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Home
        </Link>
        <div className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-muted">
          <Avatar level={level} gearSlots={gearSlots} className="h-full w-auto" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {profile?.display_name ?? "Hero"}
          </h1>
          {equippedTitle && (
            <p className="text-sm font-medium text-primary">{equippedTitle}</p>
          )}
          <p className="mt-0.5 text-sm text-muted-foreground">
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

      <div className="grid grid-cols-2 gap-3">
        <Link href="/skills" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Skill tree
        </Link>
        <Link href="/store" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Customize
        </Link>
      </div>
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
