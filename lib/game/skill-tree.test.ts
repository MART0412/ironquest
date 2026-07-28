import { describe, expect, it } from "vitest"

import { nodeState } from "./skill-tree"

// Path layout, validation and stat weighting are covered in paths.test.ts;
// this file covers the shared frontier rule those build on.
describe("nodeState (frontier / gating)", () => {
  const chain = [{ id: "p1" }, { id: "p2" }, { id: "p3" }]

  it("the first node is 'next' when nothing is unlocked", () => {
    const set = new Set<string>()
    expect(chain.map((n) => nodeState(n, chain, set))).toEqual([
      "next",
      "locked",
      "locked",
    ])
  })

  it("the frontier advances as nodes unlock", () => {
    const set = new Set(["p1"])
    expect(chain.map((n) => nodeState(n, chain, set))).toEqual([
      "unlocked",
      "next",
      "locked",
    ])
  })

  it("all unlocked → no 'next'", () => {
    const set = new Set(["p1", "p2", "p3"])
    expect(chain.map((n) => nodeState(n, chain, set))).toEqual([
      "unlocked",
      "unlocked",
      "unlocked",
    ])
  })

  it("treats a gap as unlockable at the earliest missing node", () => {
    // p1 skipped, p2 unlocked out of order → p1 is still the frontier.
    const set = new Set(["p2"])
    expect(chain.map((n) => nodeState(n, chain, set))).toEqual([
      "next",
      "unlocked",
      "locked",
    ])
  })
})
