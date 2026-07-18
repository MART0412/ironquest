// Skill-tree layout + node-state derivation (spec §3.1). Pure and decoupled
// from the renderer: the renderer consumes PositionedNode/Edge and knows
// nothing about branches. Adding a branch = one BRANCH_CONFIG entry.

import type { UnlockCriteria } from "@/lib/game/skills"

export type BranchKey = "push" | "pull" | "core" | "legs" | "static"
export type StatKey = "STR" | "PULL" | "CORE" | "LEGS" | "BALANCE"
export type NodeState = "unlocked" | "next" | "locked"

export const BRANCH_CONFIG: Record<
  BranchKey,
  { label: string; stat: StatKey; column: number; accent: string }
> = {
  push: { label: "Push", stat: "STR", column: 0, accent: "var(--chart-1)" },
  pull: { label: "Pull", stat: "PULL", column: 1, accent: "var(--chart-2)" },
  core: { label: "Core", stat: "CORE", column: 2, accent: "var(--chart-3)" },
  legs: { label: "Legs", stat: "LEGS", column: 3, accent: "var(--chart-4)" },
  static: {
    label: "Static",
    stat: "BALANCE",
    column: 4,
    accent: "var(--chart-5)",
  },
}

export const BRANCH_ORDER = (
  Object.keys(BRANCH_CONFIG) as BranchKey[]
).sort((a, b) => BRANCH_CONFIG[a].column - BRANCH_CONFIG[b].column)

// Canvas geometry (SVG user units).
export const LAYOUT = {
  colWidth: 150,
  rowHeight: 110,
  marginX: 75,
  marginTop: 90, // room for the branch label chip above tier 1
  nodeRadius: 30,
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

/**
 * Position every exercise into columns (branch) × rows (tier), derive state,
 * and emit the tier→tier edges. Deterministic; no side effects.
 */
export function buildTree(
  exercises: ExerciseNode[],
  unlocks: { exercise_id: string; unlocked_at: string }[]
): { nodes: PositionedNode[]; edges: Edge[]; width: number; height: number } {
  const unlockedAtById = new Map(unlocks.map((u) => [u.exercise_id, u.unlocked_at]))
  const unlockedIds = new Set(unlockedAtById.keys())

  const byBranch = new Map<BranchKey, ExerciseNode[]>()
  for (const ex of exercises) {
    if (!(ex.branch in BRANCH_CONFIG)) continue
    const list = byBranch.get(ex.branch) ?? []
    list.push(ex)
    byBranch.set(ex.branch, list)
  }

  const nodes: PositionedNode[] = []
  const edges: Edge[] = []
  let maxTier = 0

  for (const branch of BRANCH_ORDER) {
    const branchNodes = (byBranch.get(branch) ?? []).sort((a, b) => a.tier - b.tier)
    const col = BRANCH_CONFIG[branch].column

    branchNodes.forEach((ex, i) => {
      maxTier = Math.max(maxTier, ex.tier)
      nodes.push({
        id: ex.id,
        slug: ex.slug,
        name: ex.name,
        branch,
        tier: ex.tier,
        x: LAYOUT.marginX + col * LAYOUT.colWidth,
        y: LAYOUT.marginTop + (ex.tier - 1) * LAYOUT.rowHeight,
        state: nodeState(ex, branchNodes, unlockedIds),
        accent: BRANCH_CONFIG[branch].accent,
        criteria: ex.unlock_criteria,
        demoNotes: ex.demo_notes,
        unlockedAt: unlockedAtById.get(ex.id) ?? null,
        prerequisiteName: i > 0 ? branchNodes[i - 1].name : null,
      })
      if (i > 0) {
        edges.push({ from: branchNodes[i - 1].id, to: ex.id, branch })
      }
    })
  }

  return {
    nodes,
    edges,
    width: LAYOUT.marginX * 2 + (BRANCH_ORDER.length - 1) * LAYOUT.colWidth,
    height: LAYOUT.marginTop + maxTier * LAYOUT.rowHeight + LAYOUT.marginTop,
  }
}
