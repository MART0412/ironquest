"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  rewardFormSchema,
  type RewardFormInput,
} from "@/lib/validations/rewards"

export type ActionError = { error: string }

/** Human-readable messages for the redeem_reward RPC's raised errors. */
const REDEEM_MESSAGES: Record<string, string> = {
  insufficient_balance: "Not enough points yet — keep earning.",
  reward_archived: "That reward is archived.",
  already_redeemed: "That reward was already redeemed.",
  reward_not_found: "Reward not found.",
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function createReward(input: RewardFormInput): Promise<ActionError | { ok: true }> {
  const parsed = rewardFormSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { error } = await supabase.from("rewards").insert({
    user_id: user.id,
    title: parsed.data.title,
    cost_points: parsed.data.costPoints,
    note: parsed.data.note || null,
    type: "real_life",
  })
  if (error) return { error: "Could not create the reward. Please try again." }

  revalidatePath("/store")
  return { ok: true }
}

export async function updateReward(
  id: string,
  input: RewardFormInput
): Promise<ActionError | { ok: true }> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid reward." }
  const parsed = rewardFormSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  // Only editable while unredeemed — redeemed rewards are immutable history.
  const { error } = await supabase
    .from("rewards")
    .update({
      title: parsed.data.title,
      cost_points: parsed.data.costPoints,
      note: parsed.data.note || null,
    })
    .eq("id", id)
    .is("redeemed_at", null)
  if (error) return { error: "Could not update the reward." }

  revalidatePath("/store")
  return { ok: true }
}

export async function archiveReward(
  id: string,
  archived: boolean
): Promise<ActionError | { ok: true }> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid reward." }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { error } = await supabase
    .from("rewards")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .is("redeemed_at", null)
  if (error) return { error: "Could not archive the reward." }

  revalidatePath("/store")
  return { ok: true }
}

export type RedeemResult = {
  reward_id: string
  cost: number
  balance_before: number
  balance_after: number
  redeemed_at: string
}

export async function redeemReward(
  id: string
): Promise<ActionError | { result: RedeemResult }> {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid reward." }

  const { supabase, user } = await requireUser()
  if (!user) return { error: "Your session expired. Please sign in again." }

  const { data, error } = await supabase.rpc("redeem_reward", { p_reward_id: id })
  if (error) {
    // The RPC raises bare codes like "insufficient_balance"; map to a message.
    const code = Object.keys(REDEEM_MESSAGES).find((k) => error.message.includes(k))
    return { error: code ? REDEEM_MESSAGES[code] : "Could not redeem the reward." }
  }

  revalidatePath("/store")
  revalidatePath("/")
  return { result: data as unknown as RedeemResult }
}
