import { redirect } from "next/navigation"

import { RoutineEditor } from "@/components/routines/routine-editor"
import { createClient } from "@/lib/supabase/server"

export default async function NewRoutinePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, slug, name, branch, tier, unlock_criteria")
    .order("branch")
    .order("tier")

  return <RoutineEditor exercises={exercises ?? []} />
}
