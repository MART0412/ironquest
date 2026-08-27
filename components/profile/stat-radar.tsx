// RPG stat radar (spec §3.2). Single series over whatever axes the discipline
// defines — a pentagon for calisthenics, a triangle for running and cycling.
// Theme-token discipline: muted grid, primary fill, foreground ink labels.

import { STAT_KEYS } from "@/lib/game/stats"
import type { StatKey } from "@/lib/game/skill-tree"

const SIZE = 260
const CENTER = SIZE / 2
const RADIUS = 92
const RINGS = [0.25, 0.5, 0.75, 1]

// Axis i starts at the top and goes clockwise, whatever the axis count.
function pointFor(index: number, value: number, axisCount: number): [number, number] {
  const angle = (-90 + index * (360 / axisCount)) * (Math.PI / 180)
  return [
    CENTER + RADIUS * value * Math.cos(angle),
    CENTER + RADIUS * value * Math.sin(angle),
  ]
}

function polygon(values: number[]): string {
  return values.map((v, i) => pointFor(i, v, values.length).join(",")).join(" ")
}

export function StatRadar({
  stats,
  axes = STAT_KEYS,
}: {
  stats: Record<StatKey, number>
  /** Axis order, top-first and clockwise. Defaults to the calisthenics five. */
  axes?: StatKey[]
}) {
  const values = axes.map((s) => stats[s] ?? 0)

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
          points={polygon(axes.map(() => r))}
          fill="none"
          className="stroke-border"
          strokeWidth={1}
        />
      ))}
      {/* axes */}
      {axes.map((_, i) => {
        const [x, y] = pointFor(i, 1, axes.length)
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
        const [x, y] = pointFor(i, v, axes.length)
        return <circle key={i} cx={x} cy={y} r={3} className="fill-primary" />
      })}

      {/* axis labels + values */}
      {axes.map((stat, i) => {
        const [lx, ly] = pointFor(i, 1.28, axes.length)
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
            <tspan className="fill-muted-foreground"> {Math.round((stats[stat] ?? 0) * 100)}</tspan>
          </text>
        )
      })}
    </svg>
  )
}
