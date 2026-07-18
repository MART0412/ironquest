import * as z from "zod"

export const rewardFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "Give the reward a name." })
    .max(80, { error: "Keep the title under 80 characters." }),
  costPoints: z.coerce
    .number()
    .int({ error: "Whole points only." })
    .min(1, { error: "Cost must be at least 1 point." })
    .max(100000, { error: "That's a lot of points — keep it under 100,000." }),
  note: z.string().trim().max(280, { error: "Keep the note under 280 characters." }).optional(),
})

export type RewardFormInput = z.infer<typeof rewardFormSchema>
