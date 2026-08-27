import { redirect } from "next/navigation"

import { ActivityLogger } from "@/components/activity/activity-logger"
import { availableActivities } from "@/lib/fitness/activities"
import { createClient } from "@/lib/supabase/server"

export default async function ActivityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: profile }, { data: mine }] = await Promise.all([
    supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_disciplines")
      .select("disciplines!inner(slug)"),
  ])

  if (!profile?.onboarding_completed_at) redirect("/onboarding")

  // Bonus activities are open to everyone; endurance presets appear only for
  // the disciplines this user actually trains.
  const activeSlugs = (mine ?? []).map((row) => row.disciplines!.slug)

  return <ActivityLogger activities={availableActivities(activeSlugs)} />
}
