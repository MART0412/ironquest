// Running & cycling progression content (Phase 3, slice 3).
//
// The authoring surface for the endurance ladders. The migration seeds the
// exercises / skill_paths / skill_path_nodes rows from exactly these tables,
// and the live check asserts the database still matches.
//
// Every node is cleared by LOGGING a session that meets its criterion — the
// same evidence rule as the rest of the tree. Distance and pace are judged on a
// single session (a week of short runs is not a 10 km run); frequency is judged
// across a rolling window, which is the whole point of it.

import type { UnlockCriteria } from "@/lib/game/skills"

/** Activity slugs that count toward each discipline's ladders. */
export const QUALIFYING_ACTIVITIES: Record<string, string[]> = {
  // A jog with 5 km logged is a 5 km run in every sense that matters.
  running: ["run", "jog"],
  cycling: ["cycling-moderate", "cycling-vigorous"],
}

export type EnduranceNode = {
  slug: string
  name: string
  /** Shown on the node sheet under "Unlock criteria". */
  demoNotes: string
  criteria: UnlockCriteria
}

export type EndurancePath = {
  slug: string
  name: string
  disciplineSlug: string
  /** Grouping column on exercises; also the radar axis this path feeds. */
  branch: "distance" | "pace" | "consistency"
  nodes: EnduranceNode[]
}

const run = QUALIFYING_ACTIVITIES.running
const ride = QUALIFYING_ACTIVITIES.cycling

/** min/km from km/h — cyclists think in speed, the engine compares pace. */
function paceFromKmh(kmh: number): number {
  return 60 / kmh
}

const distanceNode = (
  slug: string,
  name: string,
  km: number,
  activities: string[],
  notes: string
): EnduranceNode => ({
  slug,
  name,
  demoNotes: notes,
  criteria: {
    kind: "distance",
    activities,
    km,
    description: `One session of ${km} km or more`,
  },
})

const frequencyNode = (
  slug: string,
  name: string,
  count: number,
  windowDays: number,
  activities: string[],
  noun: string
): EnduranceNode => ({
  slug,
  name,
  demoNotes: `Showing up is the skill. ${count} ${noun}s inside ${windowDays} days.`,
  criteria: {
    kind: "frequency",
    activities,
    count,
    windowDays,
    description: `${count} ${noun}s in ${windowDays} days`,
  },
})

export const ENDURANCE_PATHS: EndurancePath[] = [
  {
    slug: "running-distance",
    name: "Distance Path",
    disciplineSlug: "running",
    branch: "distance",
    nodes: [
      distanceNode("run-1k", "First Kilometre", 1, run, "Everyone starts here. One kilometre, all at once."),
      distanceNode("run-5k", "The Five", 5, run, "The classic distance. Most runners' bread and butter."),
      distanceNode("run-10k", "The Ten", 10, run, "Double figures — the first distance that needs a plan."),
      distanceNode("run-15k", "The Fifteen", 15, run, "Past the ten, into the long-run territory."),
      distanceNode("run-half", "Half Marathon", 21.1, run, "21.1 km. A serious morning's work."),
      distanceNode("run-30k", "The Thirty", 30, run, "The wall lives around here. Meet it."),
      distanceNode("run-marathon", "Marathon", 42.2, run, "42.2 km. The distance that made the sport."),
    ],
  },
  {
    slug: "running-pace",
    name: "Pace Path",
    disciplineSlug: "running",
    branch: "pace",
    nodes: [
      paceNode("run-pace-700", "Steady Five", 7.0, run),
      paceNode("run-pace-620", "Sub-32 Five", 6 + 20 / 60, run),
      paceNode("run-pace-600", "Sub-30 Five", 6.0, run),
      paceNode("run-pace-530", "Sub-27 Five", 5.5, run),
      paceNode("run-pace-500", "Sub-25 Five", 5.0, run),
      paceNode("run-pace-430", "Sub-22 Five", 4.5, run),
      paceNode("run-pace-400", "Sub-20 Five", 4.0, run),
    ],
  },
  {
    slug: "running-consistency",
    name: "Consistency Path",
    disciplineSlug: "running",
    branch: "consistency",
    nodes: [
      frequencyNode("run-freq-2w", "Twice in a Week", 2, 7, run, "run"),
      frequencyNode("run-freq-10m", "Ten in a Month", 10, 30, run, "run"),
      frequencyNode("run-freq-3w", "Three in a Week", 3, 7, run, "run"),
      frequencyNode("run-freq-15m", "Fifteen in a Month", 15, 30, run, "run"),
      frequencyNode("run-freq-4w", "Four in a Week", 4, 7, run, "run"),
      frequencyNode("run-freq-20m", "Twenty in a Month", 20, 30, run, "run"),
    ],
  },
  {
    slug: "cycling-distance",
    name: "Distance Path",
    disciplineSlug: "cycling",
    branch: "distance",
    nodes: [
      distanceNode("ride-5k", "First Five", 5, ride, "Round the block, but properly."),
      distanceNode("ride-20k", "The Twenty", 20, ride, "An hour in the saddle for most riders."),
      distanceNode("ride-40k", "The Forty", 40, ride, "The classic time-trial distance."),
      distanceNode("ride-50k", "Metric Half Century", 50, ride, "Fifty kilometres. A proper Sunday."),
      distanceNode("ride-100k", "Metric Century", 100, ride, "100 km. The ride cyclists actually brag about."),
      distanceNode("ride-160k", "Imperial Century", 160, ride, "100 miles. A very long day."),
    ],
  },
  {
    slug: "cycling-speed",
    name: "Speed Path",
    disciplineSlug: "cycling",
    branch: "pace",
    nodes: [
      speedNode("ride-speed-20", "Twenty at Twenty", 20, ride),
      speedNode("ride-speed-23", "Twenty-Three", 23, ride),
      speedNode("ride-speed-26", "Twenty-Six", 26, ride),
      speedNode("ride-speed-29", "Twenty-Nine", 29, ride),
      speedNode("ride-speed-32", "Thirty-Two", 32, ride),
    ],
  },
  {
    slug: "cycling-consistency",
    name: "Consistency Path",
    disciplineSlug: "cycling",
    branch: "consistency",
    nodes: [
      frequencyNode("ride-freq-2w", "Twice in a Week", 2, 7, ride, "ride"),
      frequencyNode("ride-freq-10m", "Ten in a Month", 10, 30, ride, "ride"),
      frequencyNode("ride-freq-3w", "Three in a Week", 3, 7, ride, "ride"),
      frequencyNode("ride-freq-15m", "Fifteen in a Month", 15, 30, ride, "ride"),
      frequencyNode("ride-freq-4w", "Four in a Week", 4, 7, ride, "ride"),
      frequencyNode("ride-freq-20m", "Twenty in a Month", 20, 30, ride, "ride"),
    ],
  },
]

/** A 5 km run at or under a given pace. */
function paceNode(
  slug: string,
  name: string,
  maxPacePerKm: number,
  activities: string[]
): EnduranceNode {
  const mins = Math.floor(maxPacePerKm)
  const secs = Math.round((maxPacePerKm - mins) * 60)
  const label = `${mins}:${String(secs).padStart(2, "0")}`
  return {
    slug,
    name,
    demoNotes: `Five kilometres held at ${label} per kilometre or faster.`,
    criteria: {
      kind: "pace",
      activities,
      minKm: 5,
      maxPacePerKm,
      description: `5 km at ${label} /km or faster`,
    },
  }
}

/** A 20 km ride at or above a given average speed, stored as pace. */
function speedNode(
  slug: string,
  name: string,
  kmh: number,
  activities: string[]
): EnduranceNode {
  return {
    slug,
    name,
    demoNotes: `Twenty kilometres averaging ${kmh} km/h or better.`,
    criteria: {
      kind: "pace",
      activities,
      minKm: 20,
      maxPacePerKm: paceFromKmh(kmh),
      description: `20 km at ${kmh} km/h or faster`,
    },
  }
}

/** Every endurance node, flattened — used by the seed and the live check. */
export function allEnduranceNodes(): (EnduranceNode & {
  pathSlug: string
  disciplineSlug: string
  branch: string
  position: number
})[] {
  return ENDURANCE_PATHS.flatMap((path) =>
    path.nodes.map((node, index) => ({
      ...node,
      pathSlug: path.slug,
      disciplineSlug: path.disciplineSlug,
      branch: path.branch,
      position: index + 1,
    }))
  )
}
