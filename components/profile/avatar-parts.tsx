// Avatar figure parts as DATA, not branching render code (spec §3.2).
//
// Two independent lookup axes:
//   • body silhouette  → keyed by character (+ optional discipline variant)
//   • tier flourish    → keyed by avatar tier
//   • gear overlay     → keyed by gear slot
//
// Phase 4 adds discipline variants (calisthenics / running / yoga …) by adding
// `"<character>:<discipline>"` entries to BODY_VARIANTS — a data-only change.
// The renderer (avatar.tsx) only ever looks parts up; it never branches on
// character or tier, so it needs no edits when variants are added.

import type { ReactNode } from "react"

import type { AvatarCharacter, AvatarTierKey, GearSlot } from "@/lib/game/avatar"

/** Body silhouettes, drawn in foreground ink. Key: character, or "character:discipline". */
export const BODY_VARIANTS: Record<string, ReactNode> = {
  man: (
    <>
      {/* short hair */}
      <path d="M46 40 a14 13 0 0 1 28 0 Z" />
      <circle cx={60} cy={40} r={16} />
      <rect x={45} y={56} width={30} height={46} rx={9} />
      <rect x={35} y={58} width={8} height={36} rx={4} />
      <rect x={77} y={58} width={8} height={36} rx={4} />
      <rect x={49} y={100} width={9} height={40} rx={4} />
      <rect x={62} y={100} width={9} height={40} rx={4} />
    </>
  ),
  woman: (
    <>
      {/* longer hair silhouette + slightly narrower torso taper */}
      <path d="M44 40 a16 16 0 0 1 32 0 Z" />
      <rect x={42} y={38} width={6} height={24} rx={3} />
      <rect x={72} y={38} width={6} height={24} rx={3} />
      <circle cx={60} cy={40} r={16} />
      <rect x={47} y={56} width={26} height={46} rx={9} />
      <rect x={35} y={58} width={8} height={36} rx={4} />
      <rect x={77} y={58} width={8} height={36} rx={4} />
      <rect x={49} y={100} width={9} height={40} rx={4} />
      <rect x={62} y={100} width={9} height={40} rx={4} />
    </>
  ),
}

/**
 * Body for a character, optionally specialised by training discipline.
 * Falls back to the character's base figure when no variant exists — so a
 * partially-populated Phase-4 variant set degrades gracefully.
 */
export function resolveBody(
  character: AvatarCharacter,
  discipline?: string | null
): ReactNode {
  if (discipline) {
    const variant = BODY_VARIANTS[`${character}:${discipline}`]
    if (variant) return variant
  }
  return BODY_VARIANTS[character] ?? BODY_VARIANTS.man
}

/** Tier flourishes (themeable accent), keyed by avatar tier. */
export const FLOURISH_BY_TIER: Record<AvatarTierKey, ReactNode> = {
  seedling: (
    <>
      <rect x={59} y={16} width={2} height={8} rx={1} />
      <ellipse cx={55} cy={17} rx={4} ry={2.5} />
      <ellipse cx={65} cy={17} rx={4} ry={2.5} />
    </>
  ),
  novice: <rect x={47} y={66} width={26} height={5} rx={2.5} />,
  warrior: <path d="M60 64 l7 8 l-7 8 l-7 -8 Z" />,
  champion: (
    <>
      <path d="M60 62 l7 8 l-7 8 l-7 -8 Z" />
      <path d="M48 22 l4 8 l8 -10 l8 10 l4 -8 l0 10 l-24 0 Z" />
    </>
  ),
}

/** Gear overlays, keyed by slot. Identical on every character. */
export const GEAR_BY_SLOT: Record<Exclude<GearSlot, "aura">, ReactNode> = {
  head: <rect x={44} y={33} width={32} height={7} rx={3} className="fill-primary" />,
  belt: <rect x={45} y={95} width={30} height={7} rx={2} className="fill-primary" />,
  wrist: (
    <>
      <rect x={33} y={86} width={12} height={6} rx={3} className="fill-primary" />
      <rect x={75} y={86} width={12} height={6} rx={3} className="fill-primary" />
    </>
  ),
}

/** The aura gear layer sits behind the figure. */
export const AURA_LAYER: ReactNode = (
  <>
    <circle cx={60} cy={82} r={58} className="fill-primary" opacity={0.12} />
    <circle
      cx={60}
      cy={82}
      r={58}
      className="fill-none stroke-primary"
      opacity={0.35}
      strokeWidth={1.5}
    />
  </>
)
