import { redirect } from "next/navigation"

import { type CosmeticRow } from "@/components/store/cosmetics-tab"
import { type RewardRow } from "@/components/store/rewards-tab"
import { StoreTabs } from "@/components/store/store-tabs"
import { createClient } from "@/lib/supabase/server"

type CosmeticMeta = {
  accent?: string
  slot?: string
  vars?: Record<string, string>
  background?: string
  backgroundSize?: string
}

export default async function StorePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: ledger },
    { data: rewards },
    { data: cosmetics },
    { data: owned },
    { data: equipped },
  ] = await Promise.all([
    supabase.from("xp_ledger").select("points"),
    supabase
      .from("rewards")
      .select("id, title, cost_points, note, redeemed_at, archived_at, created_at")
      .eq("type", "real_life")
      .order("created_at", { ascending: false }),
    supabase
      .from("cosmetics")
      .select("id, slug, name, type, cost_points, metadata, sort_order")
      .order("sort_order"),
    supabase.from("cosmetic_unlocks").select("cosmetic_id"),
    supabase.from("cosmetic_equipped").select("cosmetic_id"),
  ])

  const balance = (ledger ?? []).reduce((sum, r) => sum + r.points, 0)

  const rewardRows: RewardRow[] = (rewards ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    costPoints: r.cost_points,
    note: r.note,
    redeemedAt: r.redeemed_at,
    archivedAt: r.archived_at,
  }))

  const ownedIds = new Set((owned ?? []).map((o) => o.cosmetic_id))
  const equippedIds = new Set((equipped ?? []).map((e) => e.cosmetic_id))
  const cosmeticRows: CosmeticRow[] = (cosmetics ?? []).map((c) => {
    const meta = (c.metadata ?? {}) as CosmeticMeta
    const v = meta.vars ?? {}
    const preview =
      c.type === "ui_theme"
        ? {
            bg: v["--background"] ?? "oklch(1 0 0)",
            primary: v["--primary"] ?? "oklch(0.2 0 0)",
            accent: v["--accent"] ?? v["--primary"] ?? "oklch(0.5 0 0)",
            background: meta.background ?? null,
            backgroundSize: meta.backgroundSize ?? null,
          }
        : null
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      type: c.type as CosmeticRow["type"],
      costPoints: c.cost_points,
      accent: meta.accent ?? null,
      slot: meta.slot ?? null,
      preview,
      owned: ownedIds.has(c.id),
      equipped: equippedIds.has(c.id),
    }
  })

  return <StoreTabs balance={balance} rewards={rewardRows} cosmetics={cosmeticRows} />
}
