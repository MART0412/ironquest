import { describe, expect, it } from "vitest"

import { ageFromDob, cutTargets, mifflinBmr } from "./tdee"

// Smoke test proving the Vitest runner is wired. Full streak/XP edge-case
// coverage lands in Slice 4 per CLAUDE.md.
describe("tdee (smoke)", () => {
  it("computes Cut targets for a known Mifflin-St Jeor example", () => {
    // Male, 80 kg, 180 cm, 30 y, moderate (×1.55):
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780
    // TDEE = 1780 * 1.55 = 2759; Cut (17% deficit) = round(2290.0) = 2290
    const age = 30
    expect(mifflinBmr({ sex: "male", weightKg: 80, heightCm: 180, age })).toBe(
      1780
    )

    const targets = cutTargets({
      sex: "male",
      weightKg: 80,
      heightCm: 180,
      age,
      activity: "moderate",
    })

    expect(targets).toEqual({
      calTarget: 2290,
      proteinG: 160, // 2 g/kg
      carbsG: 269,
      fatG: 64, // 25% of calories / 9
    })
  })

  it("derives whole-year age and respects the birthday boundary", () => {
    const now = new Date("2026-07-12")
    expect(ageFromDob("1996-07-12", now)).toBe(30) // birthday today → ticked over
    expect(ageFromDob("1996-07-13", now)).toBe(29) // birthday tomorrow → not yet
  })
})
