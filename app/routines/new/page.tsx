import { redirect } from "next/navigation"

import { RoutineEditor } from "@/components/routines/routine-editor"
import { createClient } from "@/lib/supabase/server"

export default async function NewRoutinePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: mine } = await supabase
    .from("user_disciplines")
    .select("discipline_id")

  // The picker only offers movements from disciplines the user has activated,
  // so a routine can't be built out of a discipline they haven't unlocked.
  const activeIds = (mine ?? []).map((row) => row.discipline_id)

  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, slug, name, branch, tier, unlock_criteria")
    .in("discipline_id", activeIds)
    .order("branch")
    .order("tier")

  return <RoutineEditor exercises={exercises ?? []} />
}
