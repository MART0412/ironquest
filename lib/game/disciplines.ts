// Disciplines + multiclassing (Phase 3, slice 1).
//
// A discipline is a whole way of training — calisthenics, gym, running,
// cycling, yoga. You choose one at onboarding; a second is earned, not picked
// from a menu, which is why the gate exists. Locked disciplines stay visible:
// seeing what you can't have yet is the motivation.
//
// Pure and tested; the SQL in activate_discipline mirrors MULTICLASS_MIN_LEVEL
// and the level curve. Keep the two in lockstep — the live check asserts it.

/** How a discipline's sessions are logged. Only "sets" is implemented today. */
export type LoggingStyle = "sets" | "endurance" | "session"

/**
 * Level required in your existing training before a second discipline opens
 * up. Read from the account level (the number on home and /profile).
 */
export const MULTICLASS_MIN_LEVEL = 15

export type DisciplineMeta = {
  slug: string
  tagline: string
  /**
   * Whether this discipline has exercises and skill paths yet. Only
   * calisthenics does; flipping one of these to true is how a later slice
   * turns a discipline's tree on.
   */
  hasLibrary: boolean
  /**
   * Whether its sessions can be logged today (Mode C, /activity). Running and
   * cycling have no skill paths yet but are fully trainable, which is enough
   * to make them worth activating.
   */
  hasActivityLogging: boolean
}

export const DISCIPLINE_META: Record<string, DisciplineMeta> = {
  calisthenics: {
    slug: "calisthenics",
    tagline: "Your own bodyweight, mastered one skill at a time.",
    hasLibrary: true,
    hasActivityLogging: false,
  },
  gym: {
    slug: "gym",
    tagline: "Barbells, dumbbells and machines — load the movement.",
    hasLibrary: false,
    hasActivityLogging: false,
  },
  running: {
    slug: "running",
    tagline: "Distance, pace and the long patient build.",
    hasLibrary: false,
    hasActivityLogging: true,
  },
  cycling: {
    slug: "cycling",
    tagline: "Kilometres, climbs and time in the saddle.",
    hasLibrary: false,
    hasActivityLogging: true,
  },
  yoga: {
    slug: "yoga",
    tagline: "Mobility, balance and the positions strength forgets.",
    hasLibrary: false,
    hasActivityLogging: false,
  },
}

export type DisciplineState =
  | "active"
  | "available"
  | "coming-soon"
  | "locked"

/**
 * What a discipline card should show.
 *
 * - **active** — you train it already.
 * - **available** — you can turn it on right now.
 * - **coming-soon** — the gate is passed but there is nothing to train yet;
 *   said plainly rather than dressed up as an unlock that leads nowhere.
 * - **locked** — you haven't reached the multiclass level.
 *
 * Your *first* discipline is never locked: choosing where to start is a
 * choice, not a reward.
 */
export function disciplineState(input: {
  isActive: boolean
  /** Whether the user already trains at least one discipline. */
  hasAnyActive: boolean
  level: number
  hasLibrary: boolean
  /** A discipline you can log sessions for is worth activating even with no tree. */
  hasActivityLogging?: boolean
}): DisciplineState {
  if (input.isActive) return "active"
  if (input.hasAnyActive && input.level < MULTICLASS_MIN_LEVEL) return "locked"
  // Playable means there is something to *do*: a skill tree to climb, or a
  // way to log the sessions. Running has no paths yet but a run is a run.
  if (!input.hasLibrary && !input.hasActivityLogging) return "coming-soon"
  return "available"
}

/** Only an "available" discipline can be turned on. */
export function canActivate(state: DisciplineState): boolean {
  return state === "available"
}

/** The line under a locked card. */
export function lockMessage(): string {
  return `Unlocks at level ${MULTICLASS_MIN_LEVEL}`
}

/** Progress toward the multiclass gate, for the "level 9 / 15" hint. */
export function multiclassProgress(level: number): {
  reached: boolean
  remaining: number
} {
  const remaining = Math.max(0, MULTICLASS_MIN_LEVEL - level)
  return { reached: remaining === 0, remaining }
}

/** Metadata for a slug, with a safe fallback for a discipline we don't know. */
export function metaFor(slug: string): DisciplineMeta {
  return (
    DISCIPLINE_META[slug] ?? {
      slug,
      tagline: "",
      hasLibrary: false,
      hasActivityLogging: false,
    }
  )
}

/** One row of the discipline picker, ready to render. */
export type DisciplineOption = {
  slug: string
  name: string
  tagline: string
  state: DisciplineState
  isPrimary: boolean
}

/**
 * Turn the catalog plus what the user has activated into picker rows. One
 * place decides every card's state, so onboarding, the profile and the skill
 * tree can never disagree about what is locked.
 */
export function buildDisciplineOptions(input: {
  disciplines: { slug: string; name: string }[]
  active: { slug: string; isPrimary: boolean }[]
  level: number
}): DisciplineOption[] {
  const activeBySlug = new Map(input.active.map((a) => [a.slug, a]))
  const hasAnyActive = input.active.length > 0

  return input.disciplines.map((discipline) => {
    const meta = metaFor(discipline.slug)
    const mine = activeBySlug.get(discipline.slug)
    return {
      slug: discipline.slug,
      name: discipline.name,
      tagline: meta.tagline,
      state: disciplineState({
        isActive: !!mine,
        hasAnyActive,
        level: input.level,
        hasLibrary: meta.hasLibrary,
        hasActivityLogging: meta.hasActivityLogging,
      }),
      isPrimary: mine?.isPrimary ?? false,
    }
  })
}
