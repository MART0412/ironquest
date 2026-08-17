// Lifetime totals + real-world equivalences (Session 14).
//
// Everything you have ever logged, summed and then translated into something
// you can picture: metres climbed, tonnes pressed, floors taken. The numbers
// are deliberately loose — every string says "roughly ≈", because the point is
// scale, not precision.
//
// THIS FILE IS THE AUTHORING SURFACE. Adding a milestone is an edit here plus
// `npm run sync:milestones`, which mirrors only the numbers (id, metric,
// threshold, xp, points) into the equivalence_milestones catalog that
// complete_workout reads — no migration, ever. Copy and conversions never
// leave TypeScript.

/** How an exercise counts toward lifetime totals (exercises.movement_family). */
export type MovementFamily =
  | "pull"
  | "push"
  | "press"
  | "dip"
  | "squat"
  | "core"
  | "other"

export type MetricKey =
  | "pull_reps"
  | "push_reps"
  | "press_reps"
  | "dip_reps"
  | "squat_reps"
  | "core_reps"
  | "hold_seconds"
  | "workouts"

/**
 * Which seeded exercises make up each family. This is the same mapping the
 * migration writes into exercises.movement_family — SQL aggregates by the
 * column, the app reads the column, and this list is where both come from.
 * Anything unlisted (including user customs) is "other" and counts only toward
 * hold-seconds and workout totals.
 */
export const FAMILY_SLUGS: Record<Exclude<MovementFamily, "other">, string[]> = {
  // Full-range vertical pulls. Scapular pulls and skin-the-cats are left out —
  // they're real work, but they aren't pull-ups.
  pull: [
    "negative-pull-up",
    "pull-up",
    "chest-to-bar-pull-up",
    "archer-pull-up",
    "muscle-up",
    "one-arm-negative",
    "assisted-one-arm-pull-up",
    "one-arm-pull-up",
    "high-pull",
  ],
  push: [
    "wall-push-up",
    "incline-push-up",
    "push-up",
    "diamond-push-up",
    "archer-push-up",
    "pseudo-planche-push-up",
    "one-arm-push-up",
  ],
  // Overhead pressing — kept apart from push-ups so neither total lies.
  press: [
    "pike-push-up",
    "elevated-pike-push-up",
    "wall-handstand-push-up",
    "freestanding-hspu",
  ],
  dip: ["straight-bar-dip"],
  squat: [
    "squat",
    "split-squat",
    "bulgarian-split-squat",
    "archer-squat",
    "shrimp-squat",
    "assisted-pistol-squat",
    "pistol-squat",
    "elevated-pistol-squat",
  ],
  core: ["hanging-knee-raise", "toes-to-bar", "dragon-flag"],
}

/** Slug → family, derived from the lists above. */
export const FAMILY_BY_SLUG: Record<string, MovementFamily> = Object.fromEntries(
  Object.entries(FAMILY_SLUGS).flatMap(([family, slugs]) =>
    slugs.map((slug) => [slug, family as MovementFamily])
  )
)

export type Milestone = {
  /** Stable key; also the catalog primary key. Never reuse or renumber. */
  id: string
  /** Threshold in RAW metric units so SQL can compare without conversions. */
  at: number
  /** Short name for the ladder row. */
  label: string
  /** The line shown when it's crossed. */
  message: string
  xp: number
  points: number
}

/** A crossing the engine paid for, as returned by the SQL award path. */
export type MilestoneAward = {
  milestone_id: string
  metric: MetricKey
  threshold: number
  value: number
  xp: number
  points: number
}

/** Body weight drives the tonnage maths; 75 kg when the profile is blank. */
export type EquivalenceContext = { bodyweightKg: number }
export const DEFAULT_BODYWEIGHT_KG = 75

export type MetricConfig = {
  key: MetricKey
  /** Counter heading, e.g. "Pull-ups". */
  label: string
  /** Which column the raw total sums. */
  measure: "reps" | "seconds" | "workouts"
  /** Family whose sets feed it; null for totals that span every exercise. */
  family: MovementFamily | null
  /** Display-only translation of the raw total. */
  conversion?: {
    unit: string
    /** Display units per one raw unit. */
    per: (ctx: EquivalenceContext) => number
    decimals?: number
  }
  milestones: Milestone[]
}

const m = (
  id: string,
  at: number,
  label: string,
  message: string,
  xp: number
): Milestone => ({ id, at, label, message, xp, points: Math.round(xp / 10) })

/**
 * The catalog. Ladders are ascending; thresholds are raw metric units.
 * Landmarks mix Mexico and the US on purpose — this is the user's skyline.
 */
export const METRICS: MetricConfig[] = [
  {
    key: "pull_reps",
    label: "Pull-ups",
    measure: "reps",
    family: "pull",
    // A pull-up moves you about half a metre. Reps → metres of rope climbed.
    conversion: { unit: "m climbed", per: () => 0.5, decimals: 0 },
    milestones: [
      m("pull_castillo", 60, "El Castillo", "60 pull-ups ≈ 30 m — you've hauled yourself up the pyramid at Chichén Itzá.", 50),
      m("pull_angel", 90, "El Ángel", "90 pull-ups ≈ 45 m — that's El Ángel de la Independencia, from the pavement to the wings.", 50),
      m("pull_thirty_storeys", 200, "30 storeys", "200 pull-ups ≈ 100 m — you've climbed a 30-storey building with your arms.", 75),
      m("pull_latino", 366, "Torre Latinoamericana", "366 pull-ups ≈ 183 m — the Torre Latinoamericana, hand over hand.", 100),
      m("pull_eiffel", 600, "Eiffel Tower", "600 pull-ups ≈ 300 m — you've climbed the Eiffel Tower. No lift.", 100),
      m("pull_one_wtc", 1082, "One World Trade", "1,082 pull-ups ≈ 541 m — the tallest building in the Americas, pulled past.", 150),
      m("pull_el_capitan", 1828, "El Capitan", "1,828 pull-ups ≈ 914 m — El Capitan, top to bottom, on your arms alone.", 150),
    ],
  },
  {
    key: "push_reps",
    label: "Push-ups",
    measure: "reps",
    family: "push",
    // A push-up presses roughly 64% of your body weight. Reps → tonnes.
    conversion: {
      unit: "t pressed",
      per: (ctx) => (0.64 * ctx.bodyweightKg) / 1000,
      decimals: 1,
    },
    milestones: [
      m("push_vocho", 20, "A Vochito", "20 push-ups ≈ a VW Beetle pressed off the floor. Everyone starts somewhere.", 50),
      m("push_pickup", 100, "A pickup", "100 push-ups ≈ a pickup truck's worth of pressing.", 50),
      m("push_bus", 250, "A city bus", "250 push-ups ≈ a city bus, pressed off your chest one rep at a time.", 75),
      m("push_semi", 750, "A semi-truck", "750 push-ups ≈ a fully loaded semi-truck. You've pressed a truck.", 100),
      m("push_737", 2000, "A Boeing 737", "2,000 push-ups ≈ an empty 737. Roughly. Ish. Enormously.", 150),
    ],
  },
  {
    key: "squat_reps",
    label: "Squats",
    measure: "reps",
    family: "squat",
    // Eight squats ≈ one flight of stairs' worth of vertical leg work.
    conversion: { unit: "floors climbed", per: () => 1 / 8, decimals: 0 },
    milestones: [
      m("squat_ten_floors", 80, "Ten floors", "80 squats ≈ ten floors of stairs. Your building, no lift.", 50),
      m("squat_torre_mayor", 440, "Torre Mayor", "440 squats ≈ 55 floors — the Torre Mayor stairwell, all of it.", 75),
      m("squat_empire", 816, "Empire State", "816 squats ≈ 102 floors — the Empire State Building, on legs.", 100),
      m("squat_burj", 1304, "Burj Khalifa", "1,304 squats ≈ 163 floors — the tallest stairwell on earth.", 150),
    ],
  },
  {
    key: "hold_seconds",
    label: "Holds",
    measure: "seconds",
    family: null,
    conversion: { unit: "min under tension", per: () => 1 / 60, decimals: 0 },
    milestones: [
      m("hold_metro", 600, "A Metro ride", "10 minutes of holding — about a Metro ride across CDMX, except shaking.", 50),
      m("hold_episode", 1800, "An episode", "30 minutes under tension — a whole sitcom, arms trembling.", 75),
      m("hold_hour", 3600, "A full hour", "An hour of pure isometric hold. Sixty minutes of not moving, on purpose.", 100),
      m("hold_flight", 10800, "CDMX → LAX", "3 hours under tension — the length of the flight to Los Angeles.", 150),
    ],
  },
  {
    key: "workouts",
    label: "Workouts",
    measure: "workouts",
    family: null,
    milestones: [
      m("workouts_10", 10, "Double digits", "10 sessions logged. The habit has a pulse.", 50),
      m("workouts_50", 50, "Fifty deep", "50 sessions. This isn't a phase any more.", 75),
      m("workouts_100", 100, "Century", "100 workouts logged. Triple digits.", 100),
      m("workouts_200", 200, "Two hundred", "200 sessions. Most people never see this number.", 100),
      m("workouts_365", 365, "A year of sessions", "365 workouts — one for every day of the year.", 150),
    ],
  },
  // Counters only in v1. Adding a ladder here is a config edit plus the sync.
  {
    key: "press_reps",
    label: "Overhead presses",
    measure: "reps",
    family: "press",
    milestones: [],
  },
  { key: "dip_reps", label: "Dips", measure: "reps", family: "dip", milestones: [] },
  {
    key: "core_reps",
    label: "Leg raises",
    measure: "reps",
    family: "core",
    milestones: [],
  },
]

export const METRIC_BY_KEY: Record<MetricKey, MetricConfig> = Object.fromEntries(
  METRICS.map((metric) => [metric.key, metric])
) as Record<MetricKey, MetricConfig>

export type LifetimeTotals = Record<MetricKey, number>

export const EMPTY_TOTALS: LifetimeTotals = Object.fromEntries(
  METRICS.map((metric) => [metric.key, 0])
) as LifetimeTotals

/** A logged set, reduced to what the aggregates care about. */
export type LifetimeSet = {
  family: MovementFamily | null
  reps: number | null
  seconds: number | null
}

/**
 * Lifetime totals from raw sets. Rep metrics sum only their own family; holds
 * sum every exercise's seconds, because time under tension is time under
 * tension whatever the shape.
 */
export function aggregateLifetime(input: {
  sets: LifetimeSet[]
  workouts: number
}): LifetimeTotals {
  const totals: LifetimeTotals = { ...EMPTY_TOTALS, workouts: input.workouts }

  for (const set of input.sets) {
    for (const metric of METRICS) {
      if (metric.measure === "workouts") continue
      if (metric.family !== null && metric.family !== set.family) continue
      const value = metric.measure === "reps" ? set.reps : set.seconds
      if (value == null || value <= 0) continue
      totals[metric.key] += value
    }
  }

  return totals
}

/** Display value for a total (metres, tonnes, floors…), or the raw count. */
export function convertMetric(
  metric: MetricConfig,
  total: number,
  ctx: EquivalenceContext
): number | null {
  if (!metric.conversion) return null
  return total * metric.conversion.per(ctx)
}

/** "620 m climbed" — the converted headline, or null when there isn't one. */
export function formatConversion(
  metric: MetricConfig,
  total: number,
  ctx: EquivalenceContext
): string | null {
  const converted = convertMetric(metric, total, ctx)
  if (converted == null || !metric.conversion) return null
  const decimals = metric.conversion.decimals ?? 0
  const value = converted.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${value} ${metric.conversion.unit}`
}

/** Reaching the threshold exactly counts — 600 pull-ups is the Eiffel Tower. */
export function isAchieved(milestone: Milestone, total: number): boolean {
  return total >= milestone.at
}

export function achievedMilestones(
  metricKey: MetricKey,
  total: number
): Milestone[] {
  return METRIC_BY_KEY[metricKey].milestones.filter((ms) => isAchieved(ms, total))
}

export type NextMilestone = {
  milestone: Milestone
  remaining: number
  /** 0..1 toward this milestone, measured from the previous one. */
  progress: number
}

/** The next rung of a metric's ladder, or null once it's all climbed. */
export function nextMilestone(
  metricKey: MetricKey,
  total: number
): NextMilestone | null {
  const ladder = METRIC_BY_KEY[metricKey].milestones
  const index = ladder.findIndex((ms) => !isAchieved(ms, total))
  if (index === -1) return null

  const milestone = ladder[index]
  const floor = index > 0 ? ladder[index - 1].at : 0
  const span = milestone.at - floor
  return {
    milestone,
    remaining: milestone.at - total,
    progress: span > 0 ? Math.min(1, Math.max(0, (total - floor) / span)) : 0,
  }
}

/**
 * Milestones crossed between two snapshots. One workout can clear several
 * rungs — and several metrics — at once, so this returns every one of them in
 * ladder order.
 */
export function crossedMilestones(
  before: LifetimeTotals,
  after: LifetimeTotals
): Milestone[] {
  const crossed: Milestone[] = []
  for (const metric of METRICS) {
    for (const milestone of metric.milestones) {
      if (!isAchieved(milestone, before[metric.key]) && isAchieved(milestone, after[metric.key])) {
        crossed.push(milestone)
      }
    }
  }
  return crossed
}

const ALL_MILESTONES: Milestone[] = METRICS.flatMap((metric) => metric.milestones)

export function allMilestones(): Milestone[] {
  return ALL_MILESTONES
}

const MILESTONE_INDEX = new Map(ALL_MILESTONES.map((ms) => [ms.id, ms]))

/** Resolve copy for an id the server returned. Unknown ids read as null. */
export function milestoneById(id: string): Milestone | null {
  return MILESTONE_INDEX.get(id) ?? null
}

/** Which metric a milestone belongs to — needed to render its counter. */
export function metricOfMilestone(id: string): MetricConfig | null {
  return METRICS.find((metric) => metric.milestones.some((ms) => ms.id === id)) ?? null
}
