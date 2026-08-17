"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { MULTICLASS_MIN_LEVEL } from "@/lib/game/disciplines"
import { createClient } from "@/lib/supabase/server"

const ACTIVATE_MESSAGES: Record<string, string> = {
  multiclass_locked: `A second discipline unlocks at level ${MULTICLASS_MIN_LEVEL}. Keep training.`,
  unknown_discipline: "That discipline doesn't exist.",
}

const slugSchema = z.string().min(2).max(40)

export type ActivateResult = {
  activated: boolean
  already: boolean
  slug: string
  is_primary?: boolean
}

/**
 * Turn a discipline on. The level gate lives in the SQL function, which is the
 * only writer of user_disciplines — this action just carries the answer back.
 */
export async function activateDiscipline(
  slug: string
): Promise<{ error: string } | { result: ActivateResult }> {
  if (!slugSchema.safeParse(slug).success) {
    return { error: "That discipline doesn't exist." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { data, error } = await supabase.rpc("activate_discipline", {
    p_slug: slug,
  })

  if (error) {
    const code = Object.keys(ACTIVATE_MESSAGES).find((k) =>
      error.message.includes(k)
    )
    return { error: code ? ACTIVATE_MESSAGES[code] : "Could not activate that." }
  }

  revalidatePath("/profile")
  revalidatePath("/skills")
  revalidatePath("/")
  return { result: data as unknown as ActivateResult }
}
