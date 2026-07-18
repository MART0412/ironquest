"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { NodeDetailSheet } from "@/components/skills/node-detail-sheet"
import {
  BRANCH_CONFIG,
  BRANCH_ORDER,
  LAYOUT,
  type Edge,
  type PositionedNode,
} from "@/lib/game/skill-tree"
import { cn } from "@/lib/utils"

export type BestPerf = { reps: number | null; seconds: number | null }

type Transform = { x: number; y: number; k: number }
const MIN_K = 0.5
const MAX_K = 2.5
const TAP_THRESHOLD = 6 // px of movement below which a pointerup counts as a tap

export function SkillTreeView({
  nodes,
  edges,
  width,
  height,
  bestByExercise,
}: {
  nodes: PositionedNode[]
  edges: Edge[]
  width: number
  height: number
  bestByExercise: Record<string, BestPerf>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 })
  const [selected, setSelected] = useState<PositionedNode | null>(null)

  // Active pointers for pan (1) / pinch (2); refs so handlers stay cheap.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    startTransform: Transform
    startX: number
    startY: number
    startDist: number
    startMidX: number
    startMidY: number
    moved: number
  } | null>(null)

  // Fit the tree to the viewport on mount.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const vw = el.clientWidth
    const vh = el.clientHeight
    const k = Math.max(MIN_K, Math.min(1, (vw - 24) / width, (vh - 24) / height))
    setTransform({ x: (vw - width * k) / 2, y: 16, k })
  }, [width, height])

  const nodeById = (id: string) => nodes.find((n) => n.id === id)

  function midpoint() {
    const pts = [...pointers.current.values()]
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      gesture.current = {
        startTransform: transform,
        startX: e.clientX,
        startY: e.clientY,
        startDist: 0,
        startMidX: 0,
        startMidY: 0,
        moved: 0,
      }
    } else if (pointers.current.size === 2) {
      const m = midpoint()
      gesture.current = {
        startTransform: transform,
        startX: 0,
        startY: 0,
        startDist: m.dist,
        startMidX: m.x,
        startMidY: m.y,
        moved: TAP_THRESHOLD + 1, // a second finger cancels any pending tap
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return

    if (pointers.current.size >= 2) {
      // Pinch-zoom about the gesture midpoint.
      const m = midpoint()
      const rect = containerRef.current!.getBoundingClientRect()
      const k = clamp(g.startTransform.k * (m.dist / g.startDist), MIN_K, MAX_K)
      const px = g.startMidX - rect.left
      const py = g.startMidY - rect.top
      // keep the world point under the midpoint fixed
      const wx = (px - g.startTransform.x) / g.startTransform.k
      const wy = (py - g.startTransform.y) / g.startTransform.k
      setTransform({ x: px - wx * k, y: py - wy * k, k })
    } else {
      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY
      g.moved = Math.max(g.moved, Math.hypot(dx, dy))
      setTransform({
        x: g.startTransform.x + dx,
        y: g.startTransform.y + dy,
        k: g.startTransform.k,
      })
    }
  }

  function onPointerUp(e: React.PointerEvent, node?: PositionedNode) {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    // A clean tap (little movement) on a node opens its sheet.
    if (node && g && g.moved < TAP_THRESHOLD) setSelected(node)
    if (pointers.current.size === 0) gesture.current = null
  }

  function onWheel(e: React.WheelEvent) {
    const rect = containerRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const k = clamp(transform.k * (e.deltaY < 0 ? 1.1 : 0.9), MIN_K, MAX_K)
    const wx = (px - transform.x) / transform.k
    const wy = (py - transform.y) / transform.k
    setTransform({ x: px - wx * k, y: py - wy * k, k })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 pt-8 pb-3">
        <div>
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Home
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-semibold">Skill tree</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          drag to pan · pinch / scroll to zoom
        </p>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 touch-none overflow-hidden border-y border-border bg-muted/20"
        onPointerMove={onPointerMove}
        onWheel={onWheel}
        style={{ cursor: pointers.current.size ? "grabbing" : "grab" }}
      >
        <svg
          className="absolute inset-0 h-full w-full select-none"
          onPointerDown={onPointerDown}
          onPointerUp={(e) => onPointerUp(e)}
          onPointerCancel={(e) => onPointerUp(e)}
        >
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {/* branch label chips */}
            {BRANCH_ORDER.map((branch) => (
              <text
                key={branch}
                x={LAYOUT.marginX + BRANCH_CONFIG[branch].column * LAYOUT.colWidth}
                y={40}
                textAnchor="middle"
                className="fill-foreground text-[15px] font-semibold"
              >
                {BRANCH_CONFIG[branch].label}
              </text>
            ))}

            {/* edges */}
            {edges.map((edge) => {
              const a = nodeById(edge.from)
              const b = nodeById(edge.to)
              if (!a || !b) return null
              const lit = b.state === "unlocked"
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={2}
                  className={lit ? "stroke-primary" : "stroke-border"}
                />
              )
            })}

            {/* nodes */}
            {nodes.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                onPointerUp={(e) => onPointerUp(e, node)}
              />
            ))}
          </g>
        </svg>
      </div>

      <NodeDetailSheet
        node={selected}
        best={selected ? bestByExercise[selected.id] : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

function TreeNode({
  node,
  onPointerUp,
}: {
  node: PositionedNode
  onPointerUp: (e: React.PointerEvent) => void
}) {
  const r = LAYOUT.nodeRadius
  const unlocked = node.state === "unlocked"
  const next = node.state === "next"

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      onPointerUp={onPointerUp}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`${node.name} — ${node.state}`}
      data-slug={node.slug}
      data-state={node.state}
    >
      <circle
        r={r}
        style={{ fill: unlocked ? node.accent : "var(--card)" }}
        className={cn(
          "transition-colors",
          unlocked && "stroke-primary",
          next && "stroke-primary",
          node.state === "locked" && "stroke-border"
        )}
        strokeWidth={next ? 3 : 2}
        strokeDasharray={next ? "5 4" : undefined}
        opacity={node.state === "locked" ? 0.5 : 1}
      />
      {/* short label inside/under the node */}
      <text
        y={r + 16}
        textAnchor="middle"
        className={cn(
          "text-[12px]",
          node.state === "locked" ? "fill-muted-foreground" : "fill-foreground"
        )}
      >
        {node.name}
      </text>
      {unlocked && (
        <text y={5} textAnchor="middle" className="fill-background text-[16px] font-bold">
          ✓
        </text>
      )}
      {next && (
        <text y={5} textAnchor="middle" className="fill-primary text-[13px] font-semibold">
          NEXT
        </text>
      )}
    </g>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
