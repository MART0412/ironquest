import { redirect } from "next/navigation"

import { StoreView, type RewardRow } from "@/components/store/store-view"
import { createClient } from "@/lib/supabase/server"

export default async function StorePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: ledger }, { data: rewards }] = await Promise.all([
    supabase.from("xp_ledger").select("points"),
    supabase
      .from("rewards")
      .select("id, title, cost_points, note, redeemed_at, archived_at, created_at")
      .eq("type", "real_life")
      .order("created_at", { ascending: false }),
  ])

  const balance = (ledger ?? []).reduce((sum, r) => sum + r.points, 0)

  const rows: RewardRow[] = (rewards ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    costPoints: r.cost_points,
    note: r.note,
    redeemedAt: r.redeemed_at,
    archivedAt: r.archived_at,
  }))

  return <StoreView balance={balance} rewards={rows} />
}
