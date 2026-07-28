// App-wide art-style themes (backlog B1). A theme is a set of CSS design-token
// overrides (stored in a cosmetic's metadata.vars) applied at the root layout.
// This module turns that untrusted-shaped jsonb into a tight inline-style object,
// keeping only known tokens so nothing arbitrary reaches the DOM.

import type { CSSProperties } from "react"

/** The design tokens a theme is allowed to override (subset of app/globals.css :root). */
export const THEME_TOKEN_ALLOWLIST = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
  "--radius",
] as const

const ALLOWED = new Set<string>(THEME_TOKEN_ALLOWLIST)

/**
 * Build an inline-style object of CSS custom properties from a theme's vars,
 * keeping only allowlisted token names with string values. Returns {} for
 * missing/empty input (→ app defaults).
 */
/**
 * Optional background layer for a theme (`metadata.background`), applied
 * alongside the token overrides. CSS-only by contract: any `url(...)` is
 * rejected, so a theme can never pull in an external asset.
 */
export function backgroundStyleFrom(metadata: unknown): CSSProperties {
  if (!metadata || typeof metadata !== "object") return {}
  const meta = metadata as Record<string, unknown>

  const background = meta.background
  if (typeof background !== "string" || background.length === 0) return {}
  if (hasExternalRef(background)) return {}

  const style: Record<string, string> = {
    backgroundImage: background,
    backgroundAttachment: "fixed",
  }

  const size = meta.backgroundSize
  if (typeof size === "string" && size.length > 0 && !hasExternalRef(size)) {
    style.backgroundSize = size
  }

  return style as CSSProperties
}

function hasExternalRef(value: string): boolean {
  return /url\s*\(|@import/i.test(value)
}

export function themeStyleFromVars(vars: unknown): CSSProperties {
  if (!vars || typeof vars !== "object") return {}
  const style: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars as Record<string, unknown>)) {
    if (ALLOWED.has(key) && typeof value === "string" && value.length > 0) {
      style[key] = value
    }
  }
  return style as CSSProperties
}
