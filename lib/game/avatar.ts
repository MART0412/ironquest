// Avatar layering config (spec §3.2). Pure and decoupled from the SVG renderer:
// the renderer consumes a base-figure key + ordered gear slots and knows nothing
// about how tiers/slots map. Base figures keep the seed→warrior progression;
// tier thresholds are the ones the placeholder character-header used (0/5/10/20).

export type AvatarTierKey = "seedling" | "novice" | "warrior" | "champion"

// Which base-figure set the layered avatar draws. A free presentation choice,
// kept separate from profiles.sex (which drives the BMR calc).
export type AvatarCharacter = "man" | "woman"

/**
 * Resolve the figure to render: an explicit avatar choice wins; otherwise
 * derive from the onboarding sex (male→man, female→woman); default "man".
 * Keeps existing users sensible with no backfill, and never couples the
 * avatar to nutrition targets.
 */
export function resolveCharacter(
  sex: string | null | undefined,
  avatarCharacter: string | null | undefined
): AvatarCharacter {
  if (avatarCharacter === "man" || avatarCharacter === "woman") {
    return avatarCharacter
  }
  if (sex === "female") return "woman"
  if (sex === "male") return "man"
  return "man"
}

export type AvatarTier = {
  key: AvatarTierKey
  label: string
  minLevel: number
}

// Ordered ascending by minLevel. Kept in lockstep with the old bracket icons.
export const AVATAR_TIERS: AvatarTier[] = [
  { key: "seedling", label: "Seedling", minLevel: 0 },
  { key: "novice", label: "Novice", minLevel: 5 },
  { key: "warrior", label: "Warrior", minLevel: 10 },
  { key: "champion", label: "Champion", minLevel: 20 },
]

/** The base figure for a level — the highest tier whose threshold is met. */
export function baseFigureForLevel(level: number): AvatarTier {
  let tier = AVATAR_TIERS[0]
  for (const t of AVATAR_TIERS) {
    if (level >= t.minLevel) tier = t
  }
  return tier
}

// Gear draw order, back → front. A gear cosmetic's metadata.slot maps here;
// adding a slot is a one-line change and the renderer picks it up.
export type GearSlot = "aura" | "belt" | "wrist" | "head"
export const GEAR_SLOT_ORDER: GearSlot[] = ["aura", "belt", "wrist", "head"]

/**
 * Order the equipped gear slots by their draw order, de-duplicated, with any
 * unknown slot dropped. Deterministic regardless of input order.
 */
export function orderGear(slots: string[]): GearSlot[] {
  const present = new Set(slots)
  return GEAR_SLOT_ORDER.filter((slot) => present.has(slot))
}
