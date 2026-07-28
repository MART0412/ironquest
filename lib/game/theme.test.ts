import { describe, expect, it } from "vitest"

import { backgroundStyleFrom, themeStyleFromVars } from "./theme"

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

describe("backgroundStyleFrom", () => {
  it("applies a CSS background layer", () => {
    expect(
      backgroundStyleFrom({
        background: "linear-gradient(180deg, #000 0%, #111 100%)",
      })
    ).toEqual({
      backgroundImage: "linear-gradient(180deg, #000 0%, #111 100%)",
      backgroundAttachment: "fixed",
    })
  })

  it("carries an optional backgroundSize", () => {
    const style = backgroundStyleFrom({
      background: "repeating-linear-gradient(90deg, #0000 0 7px, #fff1 7px 8px)",
      backgroundSize: "16px 16px",
    }) as Record<string, string>
    expect(style.backgroundSize).toBe("16px 16px")
  })

  it("rejects external asset references (CSS-only by contract)", () => {
    expect(backgroundStyleFrom({ background: "url(https://evil.example/x.png)" })).toEqual({})
    expect(backgroundStyleFrom({ background: "URL( /leak.png )" })).toEqual({})
    expect(backgroundStyleFrom({ background: "@import 'x'" })).toEqual({})
    // a valid gradient keeps working even when the size is malicious
    const style = backgroundStyleFrom({
      background: "linear-gradient(#000, #111)",
      backgroundSize: "url(x.png)",
    }) as Record<string, string>
    expect(style.backgroundImage).toBe("linear-gradient(#000, #111)")
    expect(style.backgroundSize).toBeUndefined()
  })

  it("returns {} when there is no background", () => {
    expect(backgroundStyleFrom({})).toEqual({})
    expect(backgroundStyleFrom({ background: "" })).toEqual({})
    expect(backgroundStyleFrom({ background: 42 })).toEqual({})
    expect(backgroundStyleFrom(null)).toEqual({})
  })
})
