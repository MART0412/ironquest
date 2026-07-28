"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { NodeDetailSheet } from "@/components/skills/node-detail-sheet"
import {
  LAYOUT,
  type BranchTrack,
  type PositionedNode,
} from "@/lib/game/skill-tree"
import { cn } from "@/lib/utils"

export type BestPerf = { reps: number | null; seconds: number | null }

export function SkillTreeView({
  tracks,
  bestByExercise,
}: {
  tracks: BranchTrack[]
  bestByExercise: Record<string, BestPerf>
}) {
  const [selected, setSelected] = useState<PositionedNode | null>(null)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Home
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Skill tree</h1>
        <p className="text-xs text-muted-foreground">
          Each branch runs left → right: further right is harder. Tap a node for
          details.
        </p>
      </header>

      {tracks.map((track) => (
        <BranchSection key={track.key} track={track} onSelect={setSelected} />
      ))}

      <NodeDetailSheet
        node={selected}
        best={selected ? bestByExercise[selected.id] : undefined}
        onClose={() => setSelected(null)}
      />
    </main>
  )
}

function BranchSection({
  track,
  onSelect,
}: {
  track: BranchTrack
  onSelect: (node: PositionedNode) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Open each branch where the user actually is: bring the frontier ("next")
  // node into view, since a deep branch scrolls past the early tiers.
  useEffect(() => {
    const el = scrollRef.current
    const frontier = track.nodes.find((n) => n.state === "next")
    if (!el || !frontier) return
    el.scrollLeft = Math.max(0, frontier.x - el.clientWidth / 2)
  }, [track])

  return (
    <section aria-label={track.label} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-medium">{track.label}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {track.unlockedCount}/{track.total} unlocked
        </span>
      </div>

      <div
        ref={scrollRef}
        data-branch={track.key}
        className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-muted/20"
      >
        <svg
          width={track.width}
          height={track.height}
          viewBox={`0 0 ${track.width} ${track.height}`}
          className="block"
          style={{ width: track.width, height: track.height }}
          role="group"
          aria-label={`${track.label} progression`}
        >
          {track.edges.map((edge) => {
            const from = track.nodes.find((n) => n.id === edge.from)
            const to = track.nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            // Lit once the right-hand (harder) node is earned.
            const lit = to.state === "unlocked"
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x + LAYOUT.nodeRadius}
                y1={from.y}
                x2={to.x - LAYOUT.nodeRadius}
                y2={to.y}
                strokeWidth={2}
                className={lit ? "stroke-primary" : "stroke-border"}
              />
            )
          })}

          {track.nodes.map((node) => (
            <TreeNode key={node.id} node={node} onSelect={onSelect} />
          ))}
        </svg>
      </div>
    </section>
  )
}

function TreeNode({
  node,
  onSelect,
}: {
  node: PositionedNode
  onSelect: (node: PositionedNode) => void
}) {
  const r = LAYOUT.nodeRadius
  const unlocked = node.state === "unlocked"
  const next = node.state === "next"
  const lines = wrapLabel(node.name)

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${node.name} — ${node.state}`}
      data-slug={node.slug}
      data-state={node.state}
      data-tier={node.tier}
      style={{ cursor: "pointer" }}
      onClick={() => onSelect(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(node)
        }
      }}
    >
      <circle
        r={r}
        style={{ fill: unlocked ? node.accent : "var(--card)" }}
        className={cn(
          "transition-colors",
          unlocked || next ? "stroke-primary" : "stroke-border"
        )}
        strokeWidth={next ? 3 : 2}
        strokeDasharray={next ? "5 4" : undefined}
        opacity={node.state === "locked" ? 0.5 : 1}
      />

      {unlocked && (
        <text
          y={5}
          textAnchor="middle"
          className="fill-background text-[15px] font-bold"
        >
          ✓
        </text>
      )}
      {next && (
        <text
          y={4}
          textAnchor="middle"
          className="fill-primary text-[11px] font-semibold"
        >
          NEXT
        </text>
      )}
      {node.state === "locked" && (
        <text
          y={5}
          textAnchor="middle"
          className="fill-muted-foreground text-[12px]"
        >
          {node.tier}
        </text>
      )}

      {lines.map((line, i) => (
        <text
          key={i}
          y={r + 15 + i * 11}
          textAnchor="middle"
          className={cn(
            "text-[10px]",
            node.state === "locked" ? "fill-muted-foreground" : "fill-foreground"
          )}
        >
          {line}
        </text>
      ))}
    </g>
  )
}

/** Wrap a node name onto at most two short lines so labels don't collide. */
function wrapLabel(name: string, maxChars = 14): string[] {
  if (name.length <= maxChars) return [name]
  const words = name.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    if (!current) current = word
    else if (`${current} ${word}`.length <= maxChars) current += ` ${word}`
    else {
      lines.push(current)
      current = word
      if (lines.length === 1) continue
    }
  }
  if (current) lines.push(current)
  if (lines.length <= 2) return lines
  return [lines[0], `${lines.slice(1).join(" ").slice(0, maxChars - 1)}…`]
}
