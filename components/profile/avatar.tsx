// Layered SVG avatar (spec §3.2). Draw order (back → front): aura, base figure
// (character + level tier), then gear overlays.
//
// This renderer is deliberately branch-free: every visual part comes from the
// data registries in avatar-parts.tsx, looked up by character / tier / slot.
// Adding a Phase-4 discipline variant is a data-only change — no edits here.

import {
  AURA_LAYER,
  FLOURISH_BY_TIER,
  GEAR_BY_SLOT,
  resolveBody,
} from "@/components/profile/avatar-parts"
import {
  baseFigureForLevel,
  orderGear,
  type AvatarCharacter,
  type GearSlot,
} from "@/lib/game/avatar"
import { cn } from "@/lib/utils"

export function Avatar({
  level,
  character = "man",
  discipline = null,
  gearSlots = [],
  className,
}: {
  level: number
  character?: AvatarCharacter
  /** Reserved for Phase 4 discipline variants; falls back to the base figure. */
  discipline?: string | null
  gearSlots?: string[]
  className?: string
}) {
  const tier = baseFigureForLevel(level)
  const gear = orderGear(gearSlots)

  return (
    <svg
      viewBox="0 0 120 150"
      className={cn("select-none", className)}
      role="img"
      aria-label={`${character === "woman" ? "Feminine" : "Masculine"} ${tier.label} avatar, level ${level}`}
    >
      {gear.includes("aura") && <g>{AURA_LAYER}</g>}
      <g className="fill-foreground">{resolveBody(character, discipline)}</g>
      <g className="fill-primary">{FLOURISH_BY_TIER[tier.key]}</g>
      {gear
        .filter((slot): slot is Exclude<GearSlot, "aura"> => slot !== "aura")
        .map((slot) => (
          <g key={slot}>{GEAR_BY_SLOT[slot]}</g>
        ))}
    </svg>
  )
}
