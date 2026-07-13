"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getSplit } from "@/lib/data/splits"
import { activityFactor } from "@/lib/fitness/tdee"
import { createSplitRoutines } from "@/lib/routines/create-split-routines"
import { createClient } from "@/lib/supabase/server"
import {
  completeOnboardingSchema,
  type CompleteOnboardingInput,
} from "@/lib/validations/onboarding"

export type OnboardingResult = { error: string }

/**
 * Persists the finished onboarding wizard to the caller's own profile row.
 * The row already exists (created by the handle_new_user trigger), so this is
 * always an UPDATE scoped to auth.uid() (RLS enforces ownership).
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput
): Promise<OnboardingResult> {
  const parsed = completeOnboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Your session expired. Please sign in again." }
  }

  const d = parsed.data
  const split = getSplit(d.splitKey)

  // Create the split's routines BEFORE marking onboarding complete: a failure
  // here leaves onboarding incomplete and retryable (creation is name-idempotent),
  // never a "complete" profile with zero routines.
  const routinesResult = await createSplitRoutines(supabase, d.splitKey)
  if ("error" in routinesResult) return { error: routinesResult.error }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: d.displayName,
      sex: d.sex,
      dob: d.dob,
      height_cm: d.heightCm,
      weight_kg: d.weightKg,
      activity_factor: activityFactor(d.activity),
      phase: "cut",
      cal_target: d.calTarget,
      protein_g: d.proteinG,
      carbs_g: d.carbsG,
      fat_g: d.fatG,
      split_config: split ? { ...split } : { key: d.splitKey },
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    return { error: "Could not save your profile. Please try again." }
  }

  revalidatePath("/")
  redirect("/")
}
