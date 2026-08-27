"use server"

import { revalidatePath } from "next/cache"

import type { UnlockEntry } from "@/components/game/celebration"
import type { MilestoneAward } from "@/lib/game/equivalences"
import { createClient } from "@/lib/supabase/server"
import {
  logActivitySchema,
  type LogActivityInput,
} from "@/lib/validations/activities"

const LOG_MESSAGES: Record<string, string> = {
  unknown_activity: "That activity isn't in the list.",
  invalid_duration: "Enter a duration between 1 and 600 minutes.",
}

/** What log_activity returns — the whole session outcome in one payload. */
export type ActivityResult = {
  workout_id: string
  activity: string
  activity_name: string
  kind: "endurance" | "activity"
  minutes: number
  distance_km: number | null
  xp: number
  points: number
  /** True when the daily cap trimmed the award, including to zero. */
  capped: boolean
  remaining_today: number
  counted_for_streak: boolean
  streak_len: number
  multiplier: number
  milestones: number
  reset: boolean
  equivalences: MilestoneAward[]
  /** Endurance ladder rungs this session cleared. */
  unlocks: UnlockEntry[]
}

/**
 * Log a duration-based session. The XP, the daily cap and the streak decision
 * all live in the SQL function — this action just carries the answer back.
 */
export async function logActivity(
  input: LogActivityInput
): Promise<{ error: string } | { result: ActivityResult }> {
  const parsed = logActivitySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  const d = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { data, error } = await supabase.rpc("log_activity", {
    p_activity_slug: d.activitySlug,
    p_duration_min: d.durationMin,
    p_distance_km: d.distanceKm ?? undefined,
    p_notes: d.notes ?? undefined,
  })

  if (error) {
    const code = Object.keys(LOG_MESSAGES).find((k) => error.message.includes(k))
    return { error: code ? LOG_MESSAGES[code] : "Could not log that session." }
  }

  revalidatePath("/")
  revalidatePath("/stats")
  revalidatePath("/activity")
  return { result: data as unknown as ActivityResult }
}
