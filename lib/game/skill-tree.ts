// Skill-tree layout + node-state derivation (spec §3.1). Pure and decoupled
// from the renderer: the renderer consumes BranchTrack[] and knows nothing about
// which branches exist. Adding a branch = one BRANCH_CONFIG entry.
//
// Layout model: each branch is its own LEFT→RIGHT track — tier 1 at the far
// left, hardest at the far right, so moving right IS advancing the skill.
// Branches stack vertically (page scroll); a track scrolls horizontally when it
// overflows. There is no pan/zoom canvas: every node has one fixed position.

import type { UnlockCriteria } from "@/lib/game/skills"

export type BranchKey = "push" | "pull" | "core" | "legs" | "static"
export type StatKey = "STR" | "PULL" | "CORE" | "LEGS" | "BALANCE"
export type NodeState = "unlocked" | "next" | "locked"

export const BRANCH_CONFIG: Record<
  BranchKey,
  { label: string; stat: StatKey; order: number; accent: string }
> = {
  push: { label: "Push", stat: "STR", order: 0, accent: "var(--chart-1)" },
  pull: { label: "Pull", stat: "PULL", order: 1, accent: "var(--chart-2)" },
  core: { label: "Core", stat: "CORE", order: 2, accent: "var(--chart-3)" },
  legs: { label: "Legs", stat: "LEGS", order: 3, accent: "var(--chart-4)" },
  static: {
    label: "Static",
    stat: "BALANCE",
    order: 4,
    accent: "var(--chart-5)",
  },
}

/** Branches in vertical stacking order. */
export const BRANCH_ORDER = (
  Object.keys(BRANCH_CONFIG) as BranchKey[]
).sort((a, b) => BRANCH_CONFIG[a].order - BRANCH_CONFIG[b].order)

// Track geometry (SVG user units). nodeGap drives horizontal progression.
export const LAYOUT = {
  nodeGap: 104,
  marginX: 52,
  trackHeight: 132,
  nodeRadius: 26,
} as const

export type ExerciseNode = {
  id: string
  slug: string
  name: string
  branch: BranchKey
  tier: number
  unlock_criteria: UnlockCriteria | null
  demo_notes: string | null
}

export type PositionedNode = {
  id: string
  slug: string
  name: string
  branch: BranchKey
  tier: number
  x: number
  y: number
  state: NodeState
  accent: string
  criteria: UnlockCriteria | null
  demoNotes: string | null
  unlockedAt: string | null
  /** Name of the prerequisite node (for locked-state messaging), if any. */
  prerequisiteName: string | null
}

export type Edge = { from: string; to: string; branch: BranchKey }

export type BranchTrack = {
  key: BranchKey
  label: string
  stat: StatKey
  accent: string
  nodes: PositionedNode[]
  edges: Edge[]
  width: number
  height: number
  unlockedCount: number
  total: number
}

/**
 * A node's state within its (linear) branch:
 * - unlocked: present in the unlocked set
 * - next: the lowest not-yet-unlocked tier (its prerequisite is satisfied)
 * - locked: a higher tier whose prerequisite chain isn't complete
 */
export function nodeState(
  node: { id: string; tier: number },
  branchNodesAsc: { id: string; tier: number }[],
  unlockedIds: ReadonlySet<string>
): NodeState {
  if (unlockedIds.has(node.id)) return "unlocked"
  const frontier = branchNodesAsc.find((n) => !unlockedIds.has(n.id))
  return frontier && frontier.id === node.id ? "next" : "locked"
}

export type BranchValidation = {
  ok: boolean
  /** Exercise ids appearing more than once. */
  duplicateIds: string[]
  /** Tier values appearing more than once. */
  duplicateTiers: number[]
  /** True when tiers are not strictly ascending in array order. */
  outOfOrder: boolean
}

/**
 * Invariant for a rendered branch: every node unique (by id and by tier) and
 * strictly ascending by tier, so left→right always means easy→hard.
 */
export function validateBranchNodes(
  nodes: { id: string; tier: number }[]
): BranchValidation {
  const seenIds = new Set<string>()
  const duplicateIds: string[] = []
  const seenTiers = new Set<number>()
  const duplicateTiers: number[] = []
  let outOfOrder = false

  nodes.forEach((n, i) => {
    if (seenIds.has(n.id)) duplicateIds.push(n.id)
    else seenIds.add(n.id)

    if (seenTiers.has(n.tier)) duplicateTiers.push(n.tier)
    else seenTiers.add(n.tier)

    if (i > 0 && n.tier <= nodes[i - 1].tier) outOfOrder = true
  })

  return {
    ok: duplicateIds.length === 0 && duplicateTiers.length === 0 && !outOfOrder,
    duplicateIds,
    duplicateTiers,
    outOfOrder,
  }
}

/**
 * Build one horizontal track per branch. Nodes are de-duplicated by exercise id
 * and sorted by tier BEFORE positioning, so a duplicated or misordered row can
 * never reach the DOM; any such anomaly is still reported (and thrown in dev)
 * rather than silently rendered.
 */
export function buildBranchTracks(
  exercises: ExerciseNode[],
  unlocks: { exercise_id: string; unlocked_at: string }[],
  options: {
    /**
     * Throw on a genuine data fault (duplicate id/tier) instead of only
     * reporting it. Defaults to on outside production so bad seed data fails
     * loudly in dev; production always renders the corrected track.
     */
    strict?: boolean
  } = {}
): BranchTrack[] {
  const strict = options.strict ?? process.env.NODE_ENV !== "production"
  const unlockedAtById = new Map(unlocks.map((u) => [u.exercise_id, u.unlocked_at]))
  const unlockedIds = new Set(unlockedAtById.keys())

  const byBranch = new Map<BranchKey, ExerciseNode[]>()
  for (const ex of exercises) {
    if (!(ex.branch in BRANCH_CONFIG)) continue
    const list = byBranch.get(ex.branch) ?? []
    list.push(ex)
    byBranch.set(ex.branch, list)
  }

  return BRANCH_ORDER.map((branch) => {
    const config = BRANCH_CONFIG[branch]
    const raw = byBranch.get(branch) ?? []

    // Defensive: one node per exercise id, strictly ordered by tier.
    const deduped = [...new Map(raw.map((ex) => [ex.id, ex])).values()].sort(
      (a, b) => a.tier - b.tier
    )
    reportAnomalies(branch, raw, deduped, strict)

    const nodes: PositionedNode[] = deduped.map((ex, i) => ({
      id: ex.id,
      slug: ex.slug,
      name: ex.name,
      branch,
      tier: ex.tier,
      // Index-based (not tier-based) so a tier gap never leaves a hole.
      x: LAYOUT.marginX + i * LAYOUT.nodeGap,
      y: LAYOUT.trackHeight / 2,
      state: nodeState(ex, deduped, unlockedIds),
      accent: config.accent,
      criteria: ex.unlock_criteria,
      demoNotes: ex.demo_notes,
      unlockedAt: unlockedAtById.get(ex.id) ?? null,
      prerequisiteName: i > 0 ? deduped[i - 1].name : null,
    }))

    const edges: Edge[] = nodes
      .slice(1)
      .map((node, i) => ({ from: nodes[i].id, to: node.id, branch }))

    return {
      key: branch,
      label: config.label,
      stat: config.stat,
      accent: config.accent,
      nodes,
      edges,
      width:
        LAYOUT.marginX * 2 + Math.max(0, nodes.length - 1) * LAYOUT.nodeGap,
      height: LAYOUT.trackHeight,
      unlockedCount: nodes.filter((n) => n.state === "unlocked").length,
      total: nodes.length,
    }
  })
}

/** Loud when strict, logged otherwise — never silently renders a bad branch. */
function reportAnomalies(
  branch: BranchKey,
  raw: ExerciseNode[],
  deduped: ExerciseNode[],
  strict: boolean
) {
  const check = validateBranchNodes(raw)
  const dropped = raw.length - deduped.length
  if (check.ok && dropped === 0) return

  const message =
    `Skill tree: branch "${branch}" violated its ordering/uniqueness invariant ` +
    `(duplicateIds=${JSON.stringify(check.duplicateIds)}, ` +
    `duplicateTiers=${JSON.stringify(check.duplicateTiers)}, ` +
    `outOfOrder=${check.outOfOrder}, droppedRows=${dropped}). ` +
    `Rendered a de-duplicated, tier-sorted track instead — check the exercise seed data.`

  // Out-of-order raw input is expected (callers may pass unsorted rows) and is
  // corrected by sorting; only true duplication is an actual data fault.
  const isDataFault =
    check.duplicateIds.length > 0 || check.duplicateTiers.length > 0

  if (!isDataFault) return
  if (strict) throw new Error(message)
  console.error(message)
}
