import * as z from "zod"

/** A checked-off exercise from Mode A (as prescribed or long-press adjusted). */
export const checkedItemSchema = z.object({
  exerciseId: z.uuid(),
  sets: z.number().int().min(1).max(10),
  repsOrSeconds: z.number().int().min(1).max(600),
  isHold: z.boolean(),
})

export const completeWorkoutSchema = z.object({
  routineId: z.uuid({ error: "Invalid routine." }),
  items: z
    .array(checkedItemSchema)
    .min(1, { error: "Check off at least one exercise." })
    .max(20),
})

export type CheckedItemInput = z.infer<typeof checkedItemSchema>
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>
