// Shared skill-tree primitives (spec §3).
//
// The tree is organised by GOAL-SKILL PATHS — layout and stat weighting live in
// lib/game/paths.ts. This module keeps only the vocabulary both sides share:
// the five RPG stats, node state, and the frontier rule.
//
// `BranchKey` remains because exercises.branch is still a column (kept for
// schema/routine compatibility), but it no longer drives adjacency or stats.

export type BranchKey = "push" | "pull" | "core" | "legs" | "static"
export type StatKey = "STR" | "PULL" | "CORE" | "LEGS" | "BALANCE"
export type NodeState = "unlocked" | "next" | "locked"

/**
 * A node's state within an ordered progression:
 * - unlocked: present in the unlocked set
 * - next: the first not-yet-unlocked node (its prerequisite is satisfied)
 * - locked: anything further along, still gated
 *
 * Order-based, so it works for any linear progression (a path today, a branch
 * before that) — only ids and their order matter.
 */
export function nodeState(
  node: { id: string },
  orderedAsc: { id: string }[],
  unlockedIds: ReadonlySet<string>
): NodeState {
  if (unlockedIds.has(node.id)) return "unlocked"
  const frontier = orderedAsc.find((n) => !unlockedIds.has(n.id))
  return frontier && frontier.id === node.id ? "next" : "locked"
}
