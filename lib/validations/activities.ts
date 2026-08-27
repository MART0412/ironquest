import * as z from "zod"

/** A manually entered session. No GPS or wearable import in v1. */
export const logActivitySchema = z.object({
  activitySlug: z
    .string()
    .trim()
    .min(2, { error: "Choose an activity." })
    .max(40),
  durationMin: z.coerce
    .number()
    .int()
    .min(1, { error: "How long did it take?" })
    .max(600, { error: "That's over ten hours — check the number." }),
  /** Optional, and only offered for activities that track it. */
  distanceKm: z.coerce
    .number()
    .min(0)
    .max(1000, { error: "That distance looks wrong." })
    .nullish(),
  notes: z.string().trim().max(280, { error: "Keep notes under 280 characters." }).nullish(),
})

export type LogActivityInput = z.input<typeof logActivitySchema>
