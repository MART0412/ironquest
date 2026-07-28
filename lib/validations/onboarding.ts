import * as z from "zod"

import { SPLIT_KEYS } from "@/lib/data/splits"

const ACTIVITY_VALUES = [
  "sedentary",
  "light",
  "moderate",
  "very",
  "extra",
] as const

/** Raw body/identity inputs collected in onboarding steps 1–5. */
export const onboardingProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { error: "Enter at least 2 characters." })
    .max(40, { error: "Keep it under 40 characters." }),
  sex: z.enum(["male", "female"], { error: "Select an option." }),
  dob: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { error: "Enter a valid date." })
    .refine((v) => new Date(v) < new Date(), { error: "Date must be in the past." })
    .refine(
      (v) => {
        const age =
          (Date.now() - new Date(v).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        return age >= 13 && age <= 120
      },
      { error: "Age must be between 13 and 120." }
    ),
  heightCm: z.coerce
    .number()
    .min(100, { error: "Height seems too low." })
    .max(250, { error: "Height seems too high." }),
  weightKg: z.coerce
    .number()
    .min(30, { error: "Weight seems too low." })
    .max(300, { error: "Weight seems too high." }),
  activity: z.enum(ACTIVITY_VALUES, { error: "Select an activity level." }),
})

/** Editable nutrition targets from the review step. */
export const targetsSchema = z.object({
  calTarget: z.coerce
    .number()
    .int()
    .min(800, { error: "Too low." })
    .max(6000, { error: "Too high." }),
  proteinG: z.coerce.number().int().min(0).max(500),
  carbsG: z.coerce.number().int().min(0).max(1000),
  fatG: z.coerce.number().int().min(0).max(400),
})

/** Full payload the completeOnboarding server action receives. */
export const completeOnboardingSchema = onboardingProfileSchema
  .extend(targetsSchema.shape)
  .extend({
    splitKey: z.enum(SPLIT_KEYS, { error: "Choose a training split." }),
    // Avatar presentation — independent of `sex`, which drives the BMR calc.
    avatarCharacter: z.enum(["man", "woman"], {
      error: "Choose your character.",
    }),
  })

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>
export type TargetsInput = z.infer<typeof targetsSchema>
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>
