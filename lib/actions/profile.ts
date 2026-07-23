"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { createClient } from "@/lib/supabase/server"

export type ActionError = { error: string }

const characterSchema = z.enum(["man", "woman"])

/** Set the avatar's character (man/woman). Free choice; owner-RLS on profiles. */
export async function setAvatarCharacter(
  character: string
): Promise<ActionError | { ok: true }> {
  const parsed = characterSchema.safeParse(character)
  if (!parsed.success) return { error: "Invalid character." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_character: parsed.data })
    .eq("id", user.id)
  if (error) return { error: "Could not update your character." }

  revalidatePath("/profile")
  revalidatePath("/")
  return { ok: true }
}
