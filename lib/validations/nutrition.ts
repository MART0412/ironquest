import * as z from "zod"

/** Manual food entry from the quick-add form. */
export const manualMealSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Give it a name." })
    .max(80, { error: "Keep the name under 80 characters." }),
  kcal: z.coerce
    .number()
    .min(0, { error: "Calories can't be negative." })
    .max(3000, { error: "That's over 3000 kcal for one entry — split it up." }),
  protein: z.coerce.number().min(0).max(300),
  carbs: z.coerce.number().min(0).max(300),
  fat: z.coerce.number().min(0).max(300),
  serving: z.string().trim().max(40, { error: "Keep serving short." }).optional(),
  save: z.boolean(),
})

/** One-tap re-log of a library food. */
export const relogSchema = z.object({
  foodId: z.uuid(),
})

export type ManualMealInput = z.infer<typeof manualMealSchema>
export type RelogInput = z.infer<typeof relogSchema>
