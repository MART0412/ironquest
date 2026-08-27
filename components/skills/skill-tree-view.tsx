"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import {
  Celebration,
  milestoneEntries,
  unlockEntries,
  type CelebrationEntry,
} from "@/components/game/celebration"
import { NodeDetailSheet } from "@/components/skills/node-detail-sheet"
import {
  cascadeCandidates,
  PATH_LAYOUT,
  type PathNode,
  type PathTrack,
} from "@/lib/game/paths"
import { cn } from "@/lib/utils"

export type BestPerf = { reps: number | null; seconds: number | null }

/** One active discipline and the paths it contributes to the tree. */
export type DisciplineGroup = {
  slug: string
  name: string
  tracks: PathTrack[]
  /** False while a discipline is activated but has no library yet. */
  hasLibrary: boolean
  /** True when its sessions are logged from /activity instead of a tree. */
  hasActivityLogging: boolean
}

export function SkillTreeView({
  groups,
  bestByExercise,
}: {
  groups: DisciplineGroup[]
  bestByExercise: Record<string, BestPerf>
}) {
  const router = useRouter()
  // Cascade counting spans every path the user can see, whatever discipline.
  const tracks = groups.flatMap((group) => group.tracks)
  // With a single discipline the page reads exactly as it did before
  // multiclassing: no headings, just the paths.
  const grouped = groups.length > 1
  const [selected, setSelected] = useState<PathNode | null>(null)
  const [celebrating, setCelebrating] = useState<CelebrationEntry[] | null>(null)

  if (celebrating) {
    return (
      <Celebration
        entries={celebrating}
        onDone={() => {
          setCelebrating(null)
          router.refresh()
        }}
      />
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Home
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Skill paths</h1>
        <p className="text-xs text-muted-foreground">
          Each path runs left → right toward its signature skill. Tap a node for
          details.
        </p>
      </header>

      {groups.map((group) => (
        <section
          key={group.slug}
          data-discipline={group.slug}
          className="flex flex-col gap-6"
        >
          {grouped && (
            <h2 className="font-heading text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {group.name}
            </h2>
          )}

          {group.tracks.map((track) => (
            <PathSection key={track.key} track={track} onSelect={setSelected} />
          ))}

          {group.tracks.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {group.hasLibrary
                ? "No paths in this discipline yet."
                : group.hasActivityLogging
                  ? `${group.name} has no skill paths yet — log your sessions from Log activity on the home screen.`
                  : `${group.name} is activated, but its skill paths aren't built yet — they're coming in a later update.`}
            </p>
          )}
        </section>
      ))}

      <NodeDetailSheet
        node={selected}
        best={selected ? bestByExercise[selected.id] : undefined}
        cascadeCount={selected ? cascadeCandidates(tracks, selected.id).length : 0}
        onUnlocked={(result) => {
          setSelected(null)
          setCelebrating([
            ...unlockEntries(result.unlocks),
            ...milestoneEntries(result.equivalences ?? []),
          ])
        }}
        onClose={() => setSelected(null)}
      />
    </main>
  )
}

function PathSection({
  track,
  onSelect,
}: {
  track: PathTrack
  onSelect: (node: PathNode) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Open each path where the user actually is: bring the frontier ("next")
  // node into view, since a long path scrolls past the early nodes.
  useEffect(() => {
    const el = scrollRef.current
    const frontier = track.nodes.find((n) => n.state === "next")
    if (!el || !frontier) return
    el.scrollLeft = Math.max(0, frontier.x - el.clientWidth / 2)
  }, [track])

  const percent = Math.round(track.progress * 100)

  return (
    <section aria-label={track.name} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-medium">{track.name}</h2>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {percent}% · {track.unlockedCount}/{track.total}
        </span>
      </div>

      {/* Progress bar mirrors the % so scanning the page reads as a ladder. */}
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div
        ref={scrollRef}
        data-path={track.key}
        className="overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-muted/20"
      >
        <svg
          width={track.width}
          height={track.height}
          viewBox={`0 0 ${track.width} ${track.height}`}
          className="block"
          style={{ width: track.width, height: track.height }}
          role="group"
          aria-label={`${track.name} progression`}
        >
          {track.edges.map((edge) => {
            const from = track.nodes.find((n) => n.id === edge.from)
            const to = track.nodes.find((n) => n.id === edge.to)
            if (!from || !to) return null
            const lit = to.state === "unlocked"
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x + from.radius}
                y1={from.y}
                x2={to.x - to.radius}
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
  node: PathNode
  onSelect: (node: PathNode) => void
}) {
  const r = node.radius
  const unlocked = node.state === "unlocked"
  const next = node.state === "next"
  const lines = wrapLabel(node.name)

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${node.name} — ${node.state}${node.isCapstone ? ", signature skill" : ""}${node.pathCount > 1 ? `, in ${node.pathCount} paths` : ""}${node.challengeReady ? ", challenge ready" : ""}`}
      data-slug={node.slug}
      data-state={node.state}
      data-position={node.position}
      data-capstone={node.isCapstone ? "true" : "false"}
      data-path-count={node.pathCount}
      data-challenge={node.challengeReady ? "ready" : ""}
      style={{ cursor: "pointer" }}
      onClick={() => onSelect(node)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(node)
        }
      }}
    >
      {/* Capstone gets an outer ring so the goal reads at a glance. */}
      {node.isCapstone && (
        <circle
          r={r + 5}
          fill="none"
          className={unlocked ? "stroke-primary" : "stroke-border"}
          strokeWidth={1.5}
          opacity={unlocked ? 0.9 : 0.5}
        />
      )}

      <circle
        r={r}
        style={{ fill: unlocked ? node.accent : "var(--card)" }}
        className={cn(
          "transition-colors",
          unlocked || next ? "stroke-primary" : "stroke-border"
        )}
        strokeWidth={next ? 3 : node.isCapstone ? 2.5 : 2}
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
          className={cn(
            "fill-muted-foreground",
            node.isCapstone ? "text-[15px]" : "text-[12px]"
          )}
        >
          {node.isCapstone ? "★" : node.position}
        </text>
      )}

      {/* Challenge Ready: an offered/declined/failed challenge still waiting. */}
      {node.challengeReady && (
        <>
          <circle
            r={r + 3}
            fill="none"
            className="stroke-primary"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            opacity={0.9}
          />
          <g transform={`translate(${-r + 2} ${-r - 2})`}>
            <circle r={9} className="fill-primary" />
            <text
              y={3.5}
              textAnchor="middle"
              className="fill-primary-foreground text-[10px] font-bold"
            >
              ⚡
            </text>
          </g>
        </>
      )}

      {/* Shared-node badge: this exercise feeds more than one path. */}
      {node.pathCount > 1 && (
        <g transform={`translate(${r - 4} ${-r - 2})`}>
          <circle r={9} className="fill-secondary stroke-border" strokeWidth={1} />
          <text
            y={3}
            textAnchor="middle"
            className="fill-secondary-foreground text-[9px] font-semibold"
          >
            {node.pathCount}
          </text>
        </g>
      )}

      {lines.map((line, i) => (
        <text
          key={i}
          y={r + 15 + i * 11}
          textAnchor="middle"
          className={cn(
            "text-[10px]",
            node.isCapstone && "font-semibold",
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
