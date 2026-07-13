// Routine templates behind the 3 seeded splits (spec §4.2). Items reference
// seeded exercises by slug (stable keys from the Slice-2 seed migration);
// instantiation resolves slug → exercise id at runtime.

import type { SplitKey, Weekday } from "@/lib/data/splits"

export type TemplateItem = {
  slug: string
  sets: number
  repsOrSeconds: number
  isHold?: boolean
}

export type TemplateRoutine = {
  name: string
  days: Weekday[]
  items: TemplateItem[]
}

export const ROUTINE_TEMPLATES: Record<SplitKey, TemplateRoutine[]> = {
  full_body_3: [
    {
      name: "Full Body",
      days: ["mon", "wed", "fri"],
      items: [
        { slug: "push-up", sets: 3, repsOrSeconds: 10 },
        { slug: "pull-up", sets: 3, repsOrSeconds: 8 },
        { slug: "squat", sets: 3, repsOrSeconds: 20 },
        { slug: "hanging-knee-raise", sets: 3, repsOrSeconds: 10 },
        { slug: "pike-push-up", sets: 3, repsOrSeconds: 10 },
        { slug: "plank", sets: 3, repsOrSeconds: 45, isHold: true },
      ],
    },
  ],
  upper_lower_4: [
    {
      name: "Upper Body",
      days: ["mon", "thu"],
      items: [
        { slug: "pull-up", sets: 3, repsOrSeconds: 8 },
        { slug: "push-up", sets: 4, repsOrSeconds: 10 },
        { slug: "pike-push-up", sets: 3, repsOrSeconds: 10 },
        { slug: "diamond-push-up", sets: 3, repsOrSeconds: 10 },
        { slug: "hanging-knee-raise", sets: 3, repsOrSeconds: 10 },
      ],
    },
    {
      name: "Lower Body",
      days: ["tue", "fri"],
      items: [
        { slug: "squat", sets: 4, repsOrSeconds: 20 },
        { slug: "split-squat", sets: 3, repsOrSeconds: 12 },
        { slug: "bulgarian-split-squat", sets: 3, repsOrSeconds: 10 },
        { slug: "hollow-hold", sets: 3, repsOrSeconds: 30, isHold: true },
        { slug: "plank", sets: 3, repsOrSeconds: 45, isHold: true },
      ],
    },
  ],
  ppl_skill_core_5: [
    {
      name: "Push Day",
      days: ["mon"],
      items: [
        { slug: "push-up", sets: 4, repsOrSeconds: 10 },
        { slug: "diamond-push-up", sets: 3, repsOrSeconds: 10 },
        { slug: "pseudo-planche-push-up", sets: 3, repsOrSeconds: 8 },
        { slug: "pike-push-up", sets: 3, repsOrSeconds: 10 },
      ],
    },
    {
      name: "Pull Day",
      days: ["tue"],
      items: [
        { slug: "pull-up", sets: 4, repsOrSeconds: 8 },
        { slug: "scapular-pull", sets: 3, repsOrSeconds: 10 },
        { slug: "negative-pull-up", sets: 3, repsOrSeconds: 5 },
        { slug: "dead-hang", sets: 3, repsOrSeconds: 30, isHold: true },
      ],
    },
    {
      name: "Leg Day",
      days: ["wed"],
      items: [
        { slug: "squat", sets: 4, repsOrSeconds: 20 },
        { slug: "bulgarian-split-squat", sets: 3, repsOrSeconds: 10 },
        { slug: "split-squat", sets: 3, repsOrSeconds: 12 },
        { slug: "archer-squat", sets: 3, repsOrSeconds: 8 },
      ],
    },
    {
      name: "Skill Day",
      days: ["thu"],
      items: [
        { slug: "wall-handstand-hold", sets: 3, repsOrSeconds: 30, isHold: true },
        { slug: "elevated-pike-push-up", sets: 3, repsOrSeconds: 8 },
        { slug: "tuck-planche", sets: 3, repsOrSeconds: 15, isHold: true },
        { slug: "l-sit", sets: 3, repsOrSeconds: 15, isHold: true },
      ],
    },
    {
      name: "Core Day",
      days: ["fri"],
      items: [
        { slug: "hollow-hold", sets: 3, repsOrSeconds: 30, isHold: true },
        { slug: "hanging-knee-raise", sets: 3, repsOrSeconds: 10 },
        { slug: "plank", sets: 3, repsOrSeconds: 45, isHold: true },
        { slug: "toes-to-bar", sets: 3, repsOrSeconds: 8 },
      ],
    },
  ],
}
