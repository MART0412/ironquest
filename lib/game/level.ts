// Leveling curve (spec §2.1): Level N requires 500 × N^1.4 cumulative XP.
// A fresh account is Level 0 and reaches Level 1 at 500 XP — fast early
// levels, meaningful grind later (Level 10 ≈ ~6 weeks of consistency).

/** Cumulative XP required to reach level `n`. Level 0 is free. */
export function xpForLevel(n: number): number {
  if (n <= 0) return 0
  return Math.round(500 * Math.pow(n, 1.4))
}

export type LevelProgress = {
  level: number
  /** XP threshold of the current level. */
  currentThreshold: number
  /** XP threshold of the next level. */
  nextThreshold: number
  /** XP accumulated past the current threshold. */
  intoLevel: number
  /** XP still needed to reach the next level. */
  toNext: number
  /** 0..1 fill fraction for the XP bar. */
  progress: number
}

/** Level and XP-bar progress for a cumulative XP total. */
export function levelFromXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp))

  // Closed-form guess, then settle exactly (float-edge safe).
  let level = Math.max(0, Math.floor(Math.pow(xp / 500, 1 / 1.4)))
  while (xpForLevel(level + 1) <= xp) level++
  while (level > 0 && xpForLevel(level) > xp) level--

  const currentThreshold = xpForLevel(level)
  const nextThreshold = xpForLevel(level + 1)
  const intoLevel = xp - currentThreshold
  const toNext = nextThreshold - xp

  return {
    level,
    currentThreshold,
    nextThreshold,
    intoLevel,
    toNext,
    progress: intoLevel / (nextThreshold - currentThreshold),
  }
}
