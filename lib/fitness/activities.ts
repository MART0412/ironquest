// Activities + MET maths (Phase 3, slice 2).
//
// One module, three consumers: endurance sessions (running, cycling), quick
// bonus activities available to every user whatever they train, and — in
// Phase 4 — the food-compensation feature, which needs exactly this to answer
// "how much jogging is that ice cream worth?".
//
// Pure and tested. The `activities` catalog table mirrors the MET values below
// because rule 6 puts the XP decision in SQL; this file stays the source of
// truth and the live check asserts the two agree.

/** How a session is recorded. Only these two exist today. */
export type ActivityKind = "endurance" | "bonus"

export type Activity = {
  slug: string
  name: string
  /** Metabolic equivalent of task — the intensity multiplier. */
  met: number
  kind: ActivityKind
  /** Set for endurance activities: which discipline must be active to log it. */
  disciplineSlug?: string
  /** Pre-filled duration on the quick-log preset. */
  defaultMinutes: number
  /** Whether the form offers a distance field. */
  tracksDistance: boolean
}

/**
 * Tunables. XP_PER_MET_MINUTE is calibrated so a real session lands near a
 * scheduled workout's 100 XP without ever dwarfing it: a 30-minute run is
 * ~103 XP, a 15-minute jog ~37.
 */
export const ACTIVITY_XP = {
  XP_PER_MET_MINUTE: 0.35,
  /** Ceiling on activity XP per calendar day, so duration can't be farmed. */
  DAILY_CAP: 150,
  /** Below this, a session is logged but doesn't count as a streak day. */
  STREAK_MIN_MINUTES: 10,
} as const

/** MET values from the Compendium of Physical Activities, rounded. */
export const ACTIVITIES: Activity[] = [
  {
    slug: "run",
    name: "Run",
    met: 9.8,
    kind: "endurance",
    disciplineSlug: "running",
    defaultMinutes: 30,
    tracksDistance: true,
  },
  {
    slug: "jog",
    name: "Jog",
    met: 7,
    kind: "bonus",
    defaultMinutes: 15,
    tracksDistance: true,
  },
  {
    slug: "cycling-moderate",
    name: "Cycling (moderate)",
    met: 8,
    kind: "endurance",
    disciplineSlug: "cycling",
    defaultMinutes: 45,
    tracksDistance: true,
  },
  {
    slug: "cycling-vigorous",
    name: "Cycling (vigorous)",
    met: 10,
    kind: "endurance",
    disciplineSlug: "cycling",
    defaultMinutes: 45,
    tracksDistance: true,
  },
  {
    slug: "walk-brisk",
    name: "Brisk walk",
    met: 4.3,
    kind: "bonus",
    defaultMinutes: 30,
    tracksDistance: true,
  },
  {
    slug: "jump-rope",
    name: "Jump rope",
    met: 12,
    kind: "bonus",
    defaultMinutes: 15,
    tracksDistance: false,
  },
  {
    slug: "rowing",
    name: "Rowing",
    met: 8.5,
    kind: "bonus",
    defaultMinutes: 20,
    tracksDistance: true,
  },
  {
    slug: "swimming",
    name: "Swimming",
    met: 8.3,
    kind: "bonus",
    defaultMinutes: 30,
    tracksDistance: false,
  },
  {
    slug: "stair-climbing",
    name: "Stair climbing",
    met: 8.8,
    kind: "bonus",
    defaultMinutes: 15,
    tracksDistance: false,
  },
  {
    slug: "hiking",
    name: "Hiking",
    met: 6,
    kind: "bonus",
    defaultMinutes: 60,
    tracksDistance: true,
  },
]

const BY_SLUG = new Map(ACTIVITIES.map((a) => [a.slug, a]))

/** Look up an activity; null for anything this build doesn't know. */
export function activityBySlug(slug: string): Activity | null {
  return BY_SLUG.get(slug) ?? null
}

/**
 * Calories burned, the standard MET formula:
 *   kcal = MET × 3.5 × kg / 200 × minutes
 * This is the piece the compensation feature will import.
 */
export function kcalBurned(input: {
  met: number
  weightKg: number
  minutes: number
}): number {
  const { met, weightKg, minutes } = input
  if (met <= 0 || weightKg <= 0 || minutes <= 0) return 0
  return (met * 3.5 * weightKg) / 200 * minutes
}

/**
 * XP for a session: duration × intensity, scaled by the streak multiplier.
 * Deliberately independent of body weight — XP rewards the effort you put in,
 * not how heavy you happen to be.
 */
export function activityXp(input: {
  met: number
  minutes: number
  multiplier?: number
}): number {
  const { met, minutes, multiplier = 1 } = input
  if (met <= 0 || minutes <= 0) return 0
  return Math.round(met * minutes * ACTIVITY_XP.XP_PER_MET_MINUTE * multiplier)
}

/**
 * Points follow the house convention: a tenth of the XP, never multiplied.
 * They are derived from what was actually AWARDED, so the daily cap trims
 * points exactly as it trims XP — otherwise a capped session would still pay
 * full points, and the cap would only half-work.
 */
export function activityPoints(awardedXp: number, multiplier = 1): number {
  if (awardedXp <= 0 || multiplier <= 0) return 0
  return Math.max(0, Math.round(awardedXp / multiplier / 10))
}

export type CappedAward = {
  /** What is actually paid out after the cap. */
  awarded: number
  /** True when the cap trimmed the award (including to zero). */
  capped: boolean
  /** Activity XP still available today, after this award. */
  remaining: number
}

/**
 * Trim an award to what's left of today's allowance. A partly-spent cap pays
 * the remainder; an exhausted one pays nothing at all — the session still gets
 * logged, it just stops being worth XP.
 */
export function applyDailyCap(input: {
  proposed: number
  alreadyToday: number
  cap?: number
}): CappedAward {
  const cap = input.cap ?? ACTIVITY_XP.DAILY_CAP
  const spent = Math.max(0, input.alreadyToday)
  const room = Math.max(0, cap - spent)
  const awarded = Math.max(0, Math.min(input.proposed, room))
  return {
    awarded,
    capped: awarded < input.proposed,
    remaining: Math.max(0, room - awarded),
  }
}

/**
 * Whether a session is substantial enough to count as a streak day. Same rules
 * as a workout once it qualifies — a token two-minute walk shouldn't be able
 * to hold a streak together.
 */
export function qualifiesForStreak(minutes: number): boolean {
  return minutes >= ACTIVITY_XP.STREAK_MIN_MINUTES
}

/**
 * Which presets to show: every bonus activity, plus the endurance ones whose
 * discipline the user has actually activated.
 */
export function availableActivities(activeDisciplineSlugs: string[]): Activity[] {
  const active = new Set(activeDisciplineSlugs)
  return ACTIVITIES.filter(
    (a) => a.kind === "bonus" || (a.disciplineSlug && active.has(a.disciplineSlug))
  )
}
