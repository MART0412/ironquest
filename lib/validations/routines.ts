import * as z from "zod"

const WEEKDAY_VALUES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

export const routineItemSchema = z.object({
  exerciseId: z.uuid({ error: "Invalid exercise." }),
  sets: z.number().int().min(1, { error: "At least 1 set." }).max(10),
  repsOrSeconds: z
    .number()
    .int()
    .min(1, { error: "Must be at least 1." })
    .max(600),
  isHold: z.boolean(),
})

export const saveRoutineSchema = z.object({
  id: z.uuid().nullable(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(60, { error: "Keep the name under 60 characters." }),
  dayOfWeek: z.array(z.enum(WEEKDAY_VALUES)).max(7),
  items: z
    .array(routineItemSchema)
    .min(1, { error: "Add at least one exercise." })
    .max(20, { error: "Keep routines under 20 exercises." }),
})

export type RoutineItemInput = z.infer<typeof routineItemSchema>
export type SaveRoutineInput = z.infer<typeof saveRoutineSchema>
