// RPG stat radar (spec §3.2). Single-series pentagon over the five stats.
// Theme-token discipline: muted grid, primary fill, foreground ink labels.

import { STAT_KEYS } from "@/lib/game/stats"
import type { StatKey } from "@/lib/game/skill-tree"

const SIZE = 260
const CENTER = SIZE / 2
const RADIUS = 92
const RINGS = [0.25, 0.5, 0.75, 1]

// Axis i at -90° + 72°·i (STR at top, clockwise).
function pointFor(index: number, value: number): [number, number] {
  const angle = (-90 + index * (360 / STAT_KEYS.length)) * (Math.PI / 180)
  return [
    CENTER + RADIUS * value * Math.cos(angle),
    CENTER + RADIUS * value * Math.sin(angle),
  ]
}

function polygon(values: number[]): string {
  return values.map((v, i) => pointFor(i, v).join(",")).join(" ")
}

export function StatRadar({ stats }: { stats: Record<StatKey, number> }) {
  const values = STAT_KEYS.map((s) => stats[s])

  return (
    <svg
      viewBox={`-28 0 ${SIZE + 56} ${SIZE}`}
      className="mx-auto w-full max-w-[300px]"
      role="img"
      aria-label="Stat radar"
    >
      {/* grid rings */}
      {RINGS.map((r) => (
        <polygon
          key={r}
          points={polygon(STAT_KEYS.map(() => r))}
          fill="none"
          className="stroke-border"
          strokeWidth={1}
        />
      ))}
      {/* axes */}
      {STAT_KEYS.map((_, i) => {
        const [x, y] = pointFor(i, 1)
        return (
          <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} className="stroke-border" strokeWidth={1} />
        )
      })}

      {/* the character's stats */}
      <polygon
        points={polygon(values)}
        className="fill-primary/25 stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const [x, y] = pointFor(i, v)
        return <circle key={i} cx={x} cy={y} r={3} className="fill-primary" />
      })}

      {/* axis labels + values */}
      {STAT_KEYS.map((stat, i) => {
        const [lx, ly] = pointFor(i, 1.28)
        return (
          <text
            key={stat}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-[11px] font-semibold"
          >
            {stat}
            <tspan className="fill-muted-foreground"> {Math.round(stats[stat] * 100)}</tspan>
          </text>
        )
      })}
    </svg>
  )
}
