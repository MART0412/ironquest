// Macro target rings (spec §7.1). Monochrome meters: primary fill on a muted
// track (same neutral ramp), identity carried by the text labels — not color.
// `value` is 0 until food logging lands (Slice 6); the contract already takes
// consumed vs target so that slice only changes the data.

type Ring = {
  label: string
  value: number
  target: number
  unit: string
}

const SIZE = 80
const RADIUS = 32
const STROKE = 7
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function MacroRing({ label, value, target, unit }: Ring) {
  const progress = target > 0 ? Math.min(value / target, 1) : 0

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-[72px]"
        role="img"
        aria-label={`${label}: ${value} of ${target} ${unit}`}
      >
        {/* Track: lighter step of the same ramp */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          className="stroke-muted"
          strokeWidth={STROKE}
        />
        {/* Fill: rounded data-end, grows clockwise from 12 o'clock.
            Omitted entirely at 0 — a zero-length dash with round caps
            still paints a dot. */}
        {progress > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            className="stroke-primary"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${progress * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-foreground text-lg font-semibold"
        >
          {value}
        </text>
      </svg>
      <div className="text-center leading-tight">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          of {target} {unit}
        </p>
      </div>
    </div>
  )
}

export function MacroRings({
  calTarget,
  proteinG,
  carbsG,
  fatG,
  consumed = { kcal: 0, protein: 0, carbs: 0, fat: 0 },
}: {
  calTarget: number
  proteinG: number
  carbsG: number
  fatG: number
  consumed?: { kcal: number; protein: number; carbs: number; fat: number }
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      <MacroRing label="Calories" value={consumed.kcal} target={calTarget} unit="kcal" />
      <MacroRing label="Protein" value={consumed.protein} target={proteinG} unit="g" />
      <MacroRing label="Carbs" value={consumed.carbs} target={carbsG} unit="g" />
      <MacroRing label="Fat" value={consumed.fat} target={fatG} unit="g" />
    </div>
  )
}
