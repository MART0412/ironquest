"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { createClient } from "@/lib/supabase/server"

export type ActionError = { error: string }

const PURCHASE_MESSAGES: Record<string, string> = {
  insufficient_balance: "Not enough points yet — keep earning.",
  already_owned: "You already own that.",
  cosmetic_not_found: "That item no longer exists.",
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export type PurchaseResult = { cosmetic_id: string; cost: number; balance_after: number }

export async function purchaseCosmetic(
  id: string
): Promise<ActionError | { result: PurchaseResult }> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid item." }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { data, error } = await supabase.rpc("purchase_cosmetic", { p_cosmetic_id: id })
  if (error) {
    const code = Object.keys(PURCHASE_MESSAGES).find((k) => error.message.includes(k))
    return { error: code ? PURCHASE_MESSAGES[code] : "Could not complete the purchase." }
  }

  revalidatePath("/store")
  revalidatePath("/profile")
  revalidatePath("/")
  return { result: data as unknown as PurchaseResult }
}

/**
 * Equip a cosmetic. Titles and themes are single-active (equipping one
 * unequips the others of that type); gear stacks. RLS guarantees you can only
 * equip what you own, so this focuses on the single-active invariant.
 */
export async function equipCosmetic(id: string): Promise<ActionError | { ok: true }> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid item." }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { data: cosmetic } = await supabase
    .from("cosmetics")
    .select("id, type")
    .eq("id", id)
    .maybeSingle()
  if (!cosmetic) return { error: "That item no longer exists." }

  if (cosmetic.type === "title" || cosmetic.type === "theme") {
    // Clear other equipped items of the same single-active type.
    const { data: sameType } = await supabase
      .from("cosmetic_equipped")
      .select("cosmetic_id, cosmetics!inner(type)")
      .eq("cosmetics.type", cosmetic.type)
    const toClear = (sameType ?? [])
      .map((r) => r.cosmetic_id)
      .filter((cid) => cid !== id)
    if (toClear.length > 0) {
      await supabase.from("cosmetic_equipped").delete().in("cosmetic_id", toClear)
    }
  }

  const { error } = await supabase
    .from("cosmetic_equipped")
    .upsert({ user_id: user.id, cosmetic_id: id })
  if (error) return { error: "Could not equip that item." }

  revalidatePath("/store")
  revalidatePath("/profile")
  revalidatePath("/")
  return { ok: true }
}

export async function unequipCosmetic(id: string): Promise<ActionError | { ok: true }> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid item." }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { error } = await supabase
    .from("cosmetic_equipped")
    .delete()
    .eq("cosmetic_id", id)
  if (error) return { error: "Could not unequip that item." }

  revalidatePath("/store")
  revalidatePath("/profile")
  revalidatePath("/")
  return { ok: true }
}
