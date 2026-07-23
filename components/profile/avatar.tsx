// Layered SVG avatar (spec §3.2). Draw order (back → front): aura, base figure
// (by character + level tier), then gear overlays. Geometry is intentionally
// simple — illustrations can replace these parts later without touching the
// layering, which is driven by lib/game/avatar.ts. The man/woman figure sets
// differ only by a modest hair silhouette + shoulder taper (deliberately
// non-caricatured); tier flourishes and every gear layer are identical on both.

import {
  baseFigureForLevel,
  orderGear,
  type AvatarCharacter,
  type AvatarTierKey,
  type GearSlot,
} from "@/lib/game/avatar"
import { cn } from "@/lib/utils"

export function Avatar({
  level,
  character = "man",
  gearSlots = [],
  className,
}: {
  level: number
  character?: AvatarCharacter
  gearSlots?: string[]
  className?: string
}) {
  const tier = baseFigureForLevel(level)
  const gear = orderGear(gearSlots)
  const overlayGear = gear.filter((g) => g !== "aura")

  return (
    <svg
      viewBox="0 0 120 150"
      className={cn("select-none", className)}
      role="img"
      aria-label={`${character === "woman" ? "Feminine" : "Masculine"} ${tier.label} avatar, level ${level}`}
    >
      {gear.includes("aura") && <AuraLayer />}
      <BaseFigure character={character} tier={tier.key} />
      {overlayGear.map((slot) => (
        <GearLayer key={slot} slot={slot} />
      ))}
    </svg>
  )
}

function AuraLayer() {
  return (
    <>
      <circle cx={60} cy={82} r={58} className="fill-primary" opacity={0.12} />
      <circle cx={60} cy={82} r={58} className="fill-none stroke-primary" opacity={0.35} strokeWidth={1.5} />
    </>
  )
}

/** Character-specific humanoid silhouette + the shared per-tier accent flourish. */
function BaseFigure({
  character,
  tier,
}: {
  character: AvatarCharacter
  tier: AvatarTierKey
}) {
  // Woman figure: slightly narrower shoulders / gentle waist taper.
  const torso = character === "woman"
    ? { x: 47, width: 26 }
    : { x: 45, width: 30 }

  return (
    <g>
      <g className="fill-foreground">
        {/* hair silhouette (reads against the background on a monochrome figure) */}
        {character === "woman" ? (
          <>
            <path d="M44 40 a16 16 0 0 1 32 0 Z" />
            <rect x={42} y={38} width={6} height={24} rx={3} />
            <rect x={72} y={38} width={6} height={24} rx={3} />
          </>
        ) : (
          <path d="M46 40 a14 13 0 0 1 28 0 Z" />
        )}
        {/* head + body */}
        <circle cx={60} cy={40} r={16} />
        <rect x={torso.x} y={56} width={torso.width} height={46} rx={9} />
        <rect x={35} y={58} width={8} height={36} rx={4} />
        <rect x={77} y={58} width={8} height={36} rx={4} />
        <rect x={49} y={100} width={9} height={40} rx={4} />
        <rect x={62} y={100} width={9} height={40} rx={4} />
      </g>

      {/* tier flourish (themeable accent) — identical on both characters */}
      <g className="fill-primary">
        {tier === "seedling" && (
          <>
            <rect x={59} y={16} width={2} height={8} rx={1} />
            <ellipse cx={55} cy={17} rx={4} ry={2.5} />
            <ellipse cx={65} cy={17} rx={4} ry={2.5} />
          </>
        )}
        {tier === "novice" && <rect x={47} y={66} width={26} height={5} rx={2.5} />}
        {tier === "warrior" && <path d="M60 64 l7 8 l-7 8 l-7 -8 Z" />}
        {tier === "champion" && (
          <>
            <path d="M60 62 l7 8 l-7 8 l-7 -8 Z" />
            <path d="M48 22 l4 8 l8 -10 l8 10 l4 -8 l0 10 l-24 0 Z" />
          </>
        )}
      </g>
    </g>
  )
}

const GEAR: Record<Exclude<GearSlot, "aura">, React.ReactNode> = {
  head: <rect x={44} y={33} width={32} height={7} rx={3} className="fill-primary" />,
  belt: <rect x={45} y={95} width={30} height={7} rx={2} className="fill-primary" />,
  wrist: (
    <>
      <rect x={33} y={86} width={12} height={6} rx={3} className="fill-primary" />
      <rect x={75} y={86} width={12} height={6} rx={3} className="fill-primary" />
    </>
  ),
}

function GearLayer({ slot }: { slot: GearSlot }) {
  if (slot === "aura") return null
  return <g>{GEAR[slot]}</g>
}
