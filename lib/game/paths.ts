// Goal-skill PATH layout + stat weighting (spec §3). Pure and decoupled from
// the renderer: it consumes path rows as queried and emits positioned tracks.
//
// Each path is a LEFT→RIGHT progression ending in its signature skill (the
// capstone). Adjacency comes from skill_path_nodes.position — never from
// exercises.branch/tier, which are retained only for schema compatibility.
//
// Membership is many-to-many: a shared node (e.g. dead hang) appears in several
// paths. Unlocks are per-exercise, so an unlocked shared node renders unlocked
// in every path that contains it.

import { nodeState, type NodeState, type StatKey } from "@/lib/game/skill-tree"
import type { UnlockCriteria } from "@/lib/game/skills"

/**
 * How much each path contributes to each RPG stat (spec §3.1's
 * STR / PULL / CORE / LEGS / BALANCE). Tunable in one place; a path with no
 * entry simply contributes nothing.
 */
export const PATH_STAT_WEIGHTS: Record<string, Partial<Record<StatKey, number>>> = {
  planche: { STR: 0.7, CORE: 0.3 },
  "front-lever": { PULL: 0.5, CORE: 0.5 },
  "back-lever": { PULL: 0.6, CORE: 0.4 },
  "muscle-up": { PULL: 0.7, STR: 0.3 },
  "one-arm-pull-up": { PULL: 1 },
  handstand: { BALANCE: 0.7, STR: 0.3 },
  "one-arm-push-up": { STR: 1 },
  "pistol-squat": { LEGS: 1 },
  "l-sit": { CORE: 1 },
}

// Track geometry (SVG user units). The capstone is drawn larger.
export const PATH_LAYOUT = {
  nodeGap: 104,
  marginX: 56,
  trackHeight: 132,
  nodeRadius: 26,
  capstoneRadius: 34,
} as const

const PATH_ACCENTS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

/** Accent for a path by display index; cycles so an unconfigured path still renders. */
export function pathAccent(index: number): string {
  return PATH_ACCENTS[index % PATH_ACCENTS.length]
}

export type PathExercise = {
  id: string
  slug: string
  name: string
  unlock_criteria: UnlockCriteria | null
  demo_notes: string | null
}

export type PathInput = {
  slug: string
  name: string
  signatureExerciseId: string
  nodes: { position: number; exercise: PathExercise }[]
}

export type PathNode = {
  id: string
  slug: string
  name: string
  /** 1-based position within this path (left→right). */
  position: number
  x: number
  y: number
  radius: number
  state: NodeState
  accent: string
  isCapstone: boolean
  /** How many paths contain this exercise (>1 ⇒ shared). */
  pathCount: number
  criteria: UnlockCriteria | null
  demoNotes: string | null
  unlockedAt: string | null
  /** Name of the preceding node in this path, for locked-state messaging. */
  prerequisiteName: string | null
}

export type PathEdge = { from: string; to: string }

export type PathTrack = {
  key: string
  name: string
  nodes: PathNode[]
  edges: PathEdge[]
  width: number
  height: number
  unlockedCount: number
  total: number
  /** 0..1 share of the path's nodes unlocked. */
  progress: number
}

export type PathValidation = {
  ok: boolean
  duplicatePositions: number[]
  duplicateIds: string[]
  outOfOrder: boolean
}

/**
 * Invariant for a rendered path: no duplicate positions, no duplicate
 * exercises, and strictly ascending positions so left→right always means
 * easier→harder.
 */
export function validatePathNodes(
  nodes: { id: string; position: number }[]
): PathValidation {
  const seenPos = new Set<number>()
  const duplicatePositions: number[] = []
  const seenIds = new Set<string>()
  const duplicateIds: string[] = []
  let outOfOrder = false

  nodes.forEach((n, i) => {
    if (seenPos.has(n.position)) duplicatePositions.push(n.position)
    else seenPos.add(n.position)

    if (seenIds.has(n.id)) duplicateIds.push(n.id)
    else seenIds.add(n.id)

    if (i > 0 && n.position <= nodes[i - 1].position) outOfOrder = true
  })

  return {
    ok:
      duplicatePositions.length === 0 &&
      duplicateIds.length === 0 &&
      !outOfOrder,
    duplicatePositions,
    duplicateIds,
    outOfOrder,
  }
}

/**
 * Build one horizontal track per path. Nodes are de-duplicated by exercise id
 * and sorted by position before laying out, so a malformed row can never render
 * a duplicate; genuine faults are reported (and thrown when strict).
 */
export function buildPathTracks(
  paths: PathInput[],
  unlocks: { exercise_id: string; unlocked_at: string }[],
  options: { strict?: boolean } = {}
): PathTrack[] {
  const strict = options.strict ?? process.env.NODE_ENV !== "production"
  const unlockedAtById = new Map(unlocks.map((u) => [u.exercise_id, u.unlocked_at]))
  const unlockedIds = new Set(unlockedAtById.keys())

  // How many paths contain each exercise — drives the "shared" badge.
  const pathCountById = new Map<string, number>()
  for (const path of paths) {
    for (const id of new Set(path.nodes.map((n) => n.exercise.id))) {
      pathCountById.set(id, (pathCountById.get(id) ?? 0) + 1)
    }
  }

  return paths.map((path, pathIndex) => {
    const accent = pathAccent(pathIndex)

    const ordered = [
      ...new Map(path.nodes.map((n) => [n.exercise.id, n])).values(),
    ].sort((a, b) => a.position - b.position)

    reportAnomalies(path.slug, path.nodes, ordered, strict)

    const nodes: PathNode[] = ordered.map((entry, i) => {
      const isCapstone = entry.exercise.id === path.signatureExerciseId
      return {
        id: entry.exercise.id,
        slug: entry.exercise.slug,
        name: entry.exercise.name,
        position: entry.position,
        // Index-based so a position gap never leaves a hole in the row.
        x: PATH_LAYOUT.marginX + i * PATH_LAYOUT.nodeGap,
        y: PATH_LAYOUT.trackHeight / 2,
        radius: isCapstone
          ? PATH_LAYOUT.capstoneRadius
          : PATH_LAYOUT.nodeRadius,
        state: nodeState(entry.exercise, ordered.map((o) => o.exercise), unlockedIds),
        accent,
        isCapstone,
        pathCount: pathCountById.get(entry.exercise.id) ?? 1,
        criteria: entry.exercise.unlock_criteria,
        demoNotes: entry.exercise.demo_notes,
        unlockedAt: unlockedAtById.get(entry.exercise.id) ?? null,
        prerequisiteName: i > 0 ? ordered[i - 1].exercise.name : null,
      }
    })

    const edges: PathEdge[] = nodes
      .slice(1)
      .map((node, i) => ({ from: nodes[i].id, to: node.id }))

    const unlockedCount = nodes.filter((n) => n.state === "unlocked").length

    return {
      key: path.slug,
      name: path.name,
      nodes,
      edges,
      // Extra right margin so the larger capstone isn't clipped.
      width:
        PATH_LAYOUT.marginX * 2 +
        Math.max(0, nodes.length - 1) * PATH_LAYOUT.nodeGap +
        (PATH_LAYOUT.capstoneRadius - PATH_LAYOUT.nodeRadius),
      height: PATH_LAYOUT.trackHeight,
      unlockedCount,
      total: nodes.length,
      progress: nodes.length > 0 ? unlockedCount / nodes.length : 0,
    }
  })
}

/** Loud when strict, logged otherwise — never silently renders a bad path. */
function reportAnomalies(
  slug: string,
  raw: { position: number; exercise: { id: string } }[],
  deduped: { position: number; exercise: { id: string } }[],
  strict: boolean
) {
  const check = validatePathNodes(
    raw.map((n) => ({ id: n.exercise.id, position: n.position }))
  )
  const dropped = raw.length - deduped.length
  // Unsorted input is expected (and corrected by sorting); only genuine
  // duplication is a data fault.
  const isDataFault =
    check.duplicatePositions.length > 0 || check.duplicateIds.length > 0
  if (!isDataFault && dropped === 0) return
  if (!isDataFault) return

  const message =
    `Skill path "${slug}" violated its ordering/uniqueness invariant ` +
    `(duplicatePositions=${JSON.stringify(check.duplicatePositions)}, ` +
    `duplicateIds=${JSON.stringify(check.duplicateIds)}, ` +
    `outOfOrder=${check.outOfOrder}, droppedRows=${dropped}). ` +
    `Rendered a de-duplicated, position-sorted track instead — check skill_path_nodes.`

  if (strict) throw new Error(message)
  console.error(message)
}
