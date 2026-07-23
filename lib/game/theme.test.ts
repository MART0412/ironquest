import { describe, expect, it } from "vitest"

import { themeStyleFromVars } from "./theme"

describe("themeStyleFromVars", () => {
  it("keeps allowlisted --token string pairs", () => {
    const style = themeStyleFromVars({
      "--background": "oklch(0.16 0.02 275)",
      "--primary": "oklch(0.72 0.19 330)",
      "--radius": "0rem",
    })
    expect(style).toEqual({
      "--background": "oklch(0.16 0.02 275)",
      "--primary": "oklch(0.72 0.19 330)",
      "--radius": "0rem",
    })
  })

  it("drops unknown keys and non-string values", () => {
    const style = themeStyleFromVars({
      "--primary": "oklch(0.5 0 0)",
      "--not-a-token": "red",
      "background-image": "url(evil)",
      "--radius": 4, // non-string
      "--muted": "",
    }) as Record<string, unknown>
    expect(style).toEqual({ "--primary": "oklch(0.5 0 0)" })
  })

  it("returns {} for missing/empty/bad input", () => {
    expect(themeStyleFromVars(undefined)).toEqual({})
    expect(themeStyleFromVars(null)).toEqual({})
    expect(themeStyleFromVars("nope")).toEqual({})
    expect(themeStyleFromVars({})).toEqual({})
  })
})
