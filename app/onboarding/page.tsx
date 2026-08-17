import { redirect } from "next/navigation"

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { buildDisciplineOptions } from "@/lib/game/disciplines"
import { createClient } from "@/lib/supabase/server"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [{ data: profile }, { data: disciplines }] = await Promise.all([
    supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("disciplines").select("slug, name").order("display_order"),
  ])

  if (profile?.onboarding_completed_at) redirect("/")

  // Nothing is activated yet, so nothing is level-locked: your first discipline
  // is a free choice. The ones without a library read as "coming soon".
  const disciplineOptions = buildDisciplineOptions({
    disciplines: disciplines ?? [],
    active: [],
    level: 0,
  })

  return <OnboardingWizard disciplines={disciplineOptions} />
}
