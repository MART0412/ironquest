import { describe, expect, it } from "vitest"

import {
  buildDisciplineOptions,
  canActivate,
  DISCIPLINE_META,
  disciplineState,
  lockMessage,
  metaFor,
  multiclassProgress,
  MULTICLASS_MIN_LEVEL,
} from "./disciplines"

const state = (over: {
  isActive?: boolean
  hasAnyActive?: boolean
  level?: number
  hasLibrary?: boolean
}) =>
  disciplineState({
    isActive: false,
    hasAnyActive: true,
    level: 0,
    hasLibrary: true,
    ...over,
  })

describe("disciplineState — the multiclass gate", () => {
  it("locks a second discipline below the threshold", () => {
    expect(state({ level: MULTICLASS_MIN_LEVEL - 1 })).toBe("locked")
  })

  it("opens at exactly the threshold", () => {
    expect(state({ level: MULTICLASS_MIN_LEVEL })).toBe("available")
  })

  it("stays open above it", () => {
    expect(state({ level: MULTICLASS_MIN_LEVEL + 20 })).toBe("available")
  })

  it("never locks your first discipline, whatever your level", () => {
    expect(state({ hasAnyActive: false, level: 0 })).toBe("available")
  })

  it("reports a discipline you already train as active, gate or no gate", () => {
    expect(state({ isActive: true, level: 0 })).toBe("active")
    expect(state({ isActive: true, level: 99 })).toBe("active")
  })

  it("is never 'available' for something already active", () => {
    expect(canActivate(state({ isActive: true, level: 99 }))).toBe(false)
  })
})

describe("disciplineState — content honesty", () => {
  it("says coming-soon when the gate is passed but there is nothing to train", () => {
    expect(state({ level: MULTICLASS_MIN_LEVEL, hasLibrary: false })).toBe(
      "coming-soon"
    )
  })

  it("still says locked below the gate, even with no library", () => {
    // Locked is the more useful message: the level is the real obstacle.
    expect(state({ level: 0, hasLibrary: false })).toBe("locked")
  })

  it("says coming-soon for a first discipline with no library", () => {
    expect(state({ hasAnyActive: false, level: 0, hasLibrary: false })).toBe(
      "coming-soon"
    )
  })

  it("refuses activation for anything that isn't available", () => {
    expect(canActivate("available")).toBe(true)
    expect(canActivate("locked")).toBe(false)
    expect(canActivate("coming-soon")).toBe(false)
    expect(canActivate("active")).toBe(false)
  })
})

describe("copy and metadata", () => {
  it("quotes the same threshold the gate uses", () => {
    expect(lockMessage()).toBe(`Unlocks at level ${MULTICLASS_MIN_LEVEL}`)
    expect(lockMessage()).toContain("15")
  })

  it("counts down to the gate and stops at zero", () => {
    expect(multiclassProgress(0)).toEqual({ reached: false, remaining: 15 })
    expect(multiclassProgress(14)).toEqual({ reached: false, remaining: 1 })
    expect(multiclassProgress(15)).toEqual({ reached: true, remaining: 0 })
    expect(multiclassProgress(40)).toEqual({ reached: true, remaining: 0 })
  })

  it("ships exactly the five seeded disciplines, with only calisthenics playable", () => {
    expect(Object.keys(DISCIPLINE_META).sort()).toEqual([
      "calisthenics",
      "cycling",
      "gym",
      "running",
      "yoga",
    ])
    const playable = Object.values(DISCIPLINE_META).filter((m) => m.hasLibrary)
    expect(playable.map((m) => m.slug)).toEqual(["calisthenics"])
  })

  it("falls back safely for a discipline this build doesn't know", () => {
    expect(metaFor("swimming")).toEqual({
      slug: "swimming",
      tagline: "",
      hasLibrary: false,
    })
    expect(metaFor("gym").hasLibrary).toBe(false)
    expect(metaFor("calisthenics").hasLibrary).toBe(true)
  })
})

describe("buildDisciplineOptions", () => {
  const catalog = [
    { slug: "calisthenics", name: "Calisthenics" },
    { slug: "gym", name: "Gym & Weights" },
    { slug: "running", name: "Running" },
  ]

  it("marks what you train, and locks the rest below the gate", () => {
    const options = buildDisciplineOptions({
      disciplines: catalog,
      active: [{ slug: "calisthenics", isPrimary: true }],
      level: 3,
    })
    expect(options.map((o) => [o.slug, o.state])).toEqual([
      ["calisthenics", "active"],
      ["gym", "locked"],
      ["running", "locked"],
    ])
    expect(options[0].isPrimary).toBe(true)
  })

  it("opens the library-less ones as coming-soon once the gate is passed", () => {
    const options = buildDisciplineOptions({
      disciplines: catalog,
      active: [{ slug: "calisthenics", isPrimary: true }],
      level: MULTICLASS_MIN_LEVEL,
    })
    expect(options.map((o) => o.state)).toEqual([
      "active",
      "coming-soon",
      "coming-soon",
    ])
  })

  it("treats a brand-new user as free to choose", () => {
    const options = buildDisciplineOptions({
      disciplines: catalog,
      active: [],
      level: 0,
    })
    expect(options.map((o) => o.state)).toEqual([
      "available",
      "coming-soon",
      "coming-soon",
    ])
    expect(options.every((o) => o.isPrimary === false)).toBe(true)
  })

  it("preserves catalog order and carries the taglines", () => {
    const options = buildDisciplineOptions({
      disciplines: catalog,
      active: [],
      level: 0,
    })
    expect(options.map((o) => o.slug)).toEqual(["calisthenics", "gym", "running"])
    expect(options[0].tagline).toBe(DISCIPLINE_META.calisthenics.tagline)
  })
})
