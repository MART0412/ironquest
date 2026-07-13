import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { ROUTINE_TEMPLATES } from "./routine-templates"
import { SPLIT_TEMPLATES } from "./splits"

// Every slug the templates reference must exist in the seed migration —
// catches template/seed drift at test time instead of at instantiation time.
const SEED_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260713055757_seed_exercises.sql"
)

function seededSlugs(): Set<string> {
  const sql = readFileSync(SEED_MIGRATION, "utf8")
  return new Set(
    [...sql.matchAll(/^\('([a-z0-9-]+)'/gm)].map((m) => m[1])
  )
}

describe("routine templates", () => {
  it("references only slugs that exist in the exercise seed", () => {
    const seeded = seededSlugs()
    expect(seeded.size).toBe(47) // guard against the regex silently matching nothing

    const referenced = Object.values(ROUTINE_TEMPLATES)
      .flat()
      .flatMap((r) => r.items.map((i) => i.slug))
    const missing = [...new Set(referenced)].filter((s) => !seeded.has(s))
    expect(missing).toEqual([])
  })

  it("covers every split with well-formed routines", () => {
    for (const split of SPLIT_TEMPLATES) {
      const routines = ROUTINE_TEMPLATES[split.key]
      expect(routines.length).toBeGreaterThan(0)

      for (const r of routines) {
        expect(r.items.length).toBeGreaterThanOrEqual(1)
        expect(r.items.length).toBeLessThanOrEqual(20)
        expect(r.days.length).toBeGreaterThan(0)
        for (const item of r.items) {
          expect(item.sets).toBeGreaterThanOrEqual(1)
          expect(item.sets).toBeLessThanOrEqual(10)
          expect(item.repsOrSeconds).toBeGreaterThanOrEqual(1)
          expect(item.repsOrSeconds).toBeLessThanOrEqual(600)
        }
      }

      // Template training days match the split's declared non-rest days.
      const splitDays = Object.entries(split.days)
        .filter(([, focus]) => focus !== "Rest")
        .map(([day]) => day)
        .sort()
      const routineDays = [...new Set(routines.flatMap((r) => r.days))].sort()
      expect(routineDays).toEqual(splitDays)
    }
  })
})
