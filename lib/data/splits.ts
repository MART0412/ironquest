// The 3 seeded template splits (spec §4.2). Structure only for Slice 1 — the
// routine builder that fleshes out exercises per day lands in Slice 3.
// The chosen template's shape is stored verbatim in profiles.split_config.

export type Weekday =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun"

export const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
]

export type SplitKey = "full_body_3" | "upper_lower_4" | "ppl_skill_core_5"

/** A day is either a training focus label or a scheduled rest day. */
export type DayFocus = string

export type SplitTemplate = {
  key: SplitKey
  name: string
  description: string
  daysPerWeek: number
  /** Focus per weekday; "Rest" marks a scheduled recovery day. */
  days: Record<Weekday, DayFocus>
}

const REST = "Rest"

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    key: "full_body_3",
    name: "3-Day Full Body",
    description: "Full-body sessions Mon/Wed/Fri. Great for beginners or a busy week.",
    daysPerWeek: 3,
    days: {
      mon: "Full Body",
      tue: REST,
      wed: "Full Body",
      thu: REST,
      fri: "Full Body",
      sat: REST,
      sun: REST,
    },
  },
  {
    key: "upper_lower_4",
    name: "4-Day Upper / Lower",
    description: "Upper and lower splits twice each week. Balanced strength and recovery.",
    daysPerWeek: 4,
    days: {
      mon: "Upper",
      tue: "Lower",
      wed: REST,
      thu: "Upper",
      fri: "Lower",
      sat: REST,
      sun: REST,
    },
  },
  {
    key: "ppl_skill_core_5",
    name: "5-Day Push / Pull / Legs / Skill / Core",
    description: "Highest frequency: dedicated skill and core days for calisthenics progress.",
    daysPerWeek: 5,
    days: {
      mon: "Push",
      tue: "Pull",
      wed: "Legs",
      thu: "Skill",
      fri: "Core",
      sat: REST,
      sun: REST,
    },
  },
]

export function getSplit(key: SplitKey): SplitTemplate | undefined {
  return SPLIT_TEMPLATES.find((s) => s.key === key)
}

export const SPLIT_KEYS = SPLIT_TEMPLATES.map((s) => s.key) as [
  SplitKey,
  ...SplitKey[],
]
