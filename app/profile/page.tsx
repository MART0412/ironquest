import type { CSSProperties } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { Avatar } from "@/components/profile/avatar"
import { CharacterPicker } from "@/components/profile/character-picker"
import { StatRadar } from "@/components/profile/stat-radar"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveCharacter } from "@/lib/game/avatar"
import { levelFromXp } from "@/lib/game/level"
import { multiplierFor } from "@/lib/game/streak"
import { computePathStats } from "@/lib/game/stats"
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
    { data: paths },
    { data: unlocks },
    { data: equipped },
    { data: streak },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, sex, avatar_character")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("xp_ledger").select("xp"),
    // Path membership drives the stat radar (spec §3.1/§3.2).
    supabase
      .from("skill_paths")
      .select("slug, skill_path_nodes(exercise_id)"),
    supabase.from("skill_unlocks").select("exercise_id"),
    // Equipped cosmetics with their catalog metadata (title/theme/gear).
    supabase
      .from("cosmetic_equipped")
      .select("cosmetics!inner(name, type, metadata)"),
    supabase
      .from("streaks")
      .select("current_len, best_len")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const totalXp = (ledger ?? []).reduce((sum, r) => sum + r.xp, 0)
  const { level } = levelFromXp(totalXp)
  const streakLen = streak?.current_len ?? 0
  const bestLen = streak?.best_len ?? 0
  const character = resolveCharacter(profile?.sex, profile?.avatar_character)

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

  // Per-path progress → the five stats. A shared node counts toward every path
  // that contains it, which is exactly how the tree renders it.
  const unlockedIds = new Set((unlocks ?? []).map((u) => u.exercise_id))
  const progressByPath: Record<string, number> = {}
  for (const path of paths ?? []) {
    const nodeIds = (path.skill_path_nodes ?? []).map((n) => n.exercise_id)
    if (nodeIds.length === 0) continue
    const done = nodeIds.filter((id) => unlockedIds.has(id)).length
    progressByPath[path.slug] = done / nodeIds.length
  }
  const unlockedCount = unlockedIds.size

  const stats = computePathStats(progressByPath)

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
          <Avatar level={level} character={character} gearSlots={gearSlots} className="h-full w-auto" />
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
          <p className="mt-1 text-sm font-medium">
            🔥 {streakLen}-day streak
            {streakLen > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ×{multiplierFor(streakLen).toFixed(2)}
              </span>
            )}
            {bestLen > streakLen && (
              <span className="text-muted-foreground"> · best {bestLen}</span>
            )}
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

      <Card>
        <CardHeader>
          <CardTitle>Character</CardTitle>
        </CardHeader>
        <CardContent>
          <CharacterPicker current={character} level={level} />
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

