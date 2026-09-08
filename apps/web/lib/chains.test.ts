import { describe, it, expect } from "vitest"
import { CHAINS, LIVE_CHAINS, LIVE_CHAIN_COUNT, VISIBLE_CHAINS } from "./chains"

/**
 * The chain registry is DATA that three surfaces render from: the cards on
 * /chains, the per-chain pages, and copy elsewhere that derives its wording
 * from the same lists. A wrong entry is visible immediately. A MISSING entry is
 * not, and that is the failure this file exists for.
 *
 * On 2026-09-08 the LayerZero entry was deleted by a line-range edit that was
 * meant to remove only its neighbour. The edit asserted that its slice
 * CONTAINED the text it meant to delete, which was true, and never that the
 * slice contained ONLY that. `/chains` renders its cross-chain section behind
 * `crossChain.length > 0`, so the section stopped existing rather than
 * breaking, and it shipped. A duplicate Stellar entry survived in the same file
 * for weeks by the same silence.
 */
describe("the chain registry is complete and internally consistent", () => {
  it("has no duplicate slugs", () => {
    const seen = new Map<string, number>()
    for (const c of CHAINS) seen.set(c.slug, (seen.get(c.slug) ?? 0) + 1)
    expect(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([s]) => s)).toEqual([])
  })

  it("has no duplicate names", () => {
    const seen = new Map<string, number>()
    for (const c of CHAINS) seen.set(c.name, (seen.get(c.name) ?? 0) + 1)
    expect(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([s]) => s)).toEqual([])
  })

  // Every family the page renders a section for must actually have members, or
  // the section silently disappears rather than failing.
  it("keeps at least one chain in every family the page renders", () => {
    for (const family of ["evm", "non-evm", "cross-chain"] as const) {
      expect(VISIBLE_CHAINS.filter(c => c.family === family).length, family).toBeGreaterThan(0)
    }
  })

  // LayerZero is named explicitly because it is the ONLY member of its family,
  // so losing it is the one deletion that empties a whole section.
  it("still has LayerZero, the only cross-chain entry", () => {
    const lz = CHAINS.find(c => c.slug === "layerzero")
    expect(lz, "the LayerZero entry has been deleted").toBeTruthy()
    expect(lz?.family).toBe("cross-chain")
    expect(lz?.status).toBe("live")
  })

  // It is a message layer, not a network, so it must not be counted among the
  // chains we claim are live. LIVE_CHAINS already excludes it; this pins that.
  it("does not count LayerZero as a live chain", () => {
    expect(LIVE_CHAINS.some(c => c.slug === "layerzero")).toBe(false)
    expect(LIVE_CHAIN_COUNT).toBe(LIVE_CHAINS.length)
  })

  it("gives every chain the fields its page renders", () => {
    for (const c of VISIBLE_CHAINS) {
      expect(c.slug, `${c.name} slug`).toMatch(/^[a-z0-9-]+$/)
      expect(c.name.length, `${c.slug} name`).toBeGreaterThan(0)
      expect(c.color, `${c.slug} color`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      if (c.logo !== undefined) expect(c.logo, `${c.slug} logo`).toMatch(/^\/chains\//)
      expect(c.tagline.length, `${c.slug} tagline`).toBeGreaterThan(10)
      expect(c.intro.length, `${c.slug} intro`).toBeGreaterThan(40)
      expect(c.failures.length, `${c.slug} failures`).toBeGreaterThanOrEqual(3)
    }
  })

  // Every logo a page points at must EXIST, or the mark silently falls back to
  // a monogram and nobody notices which chains lost their branding.
  it("points every chain at a logo file that exists", async () => {
    const { existsSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const missing = VISIBLE_CHAINS
      .filter((c): c is typeof c & { logo: string } => c.logo !== undefined)
      .filter(c => !existsSync(resolve(__dirname, "..", "public", c.logo.replace(/^\//, ""))))
      .map(c => `${c.name} wants ${c.logo}`)
    // No exceptions. Every chain shown has a real mark; a monogram is a
    // fallback for a missing file, not a design choice, and it went unnoticed
    // once because the exception below used to name it.
    expect(missing).toEqual([])
  })

  /**
   * Making `logo` optional gave the previous guard an exit: omit the path and
   * the missing-file check no longer applies. So the chains without a mark are
   * pinned here by name. Adding one is then a deliberate edit to this list with
   * a reviewer looking at it, which is the whole point of the guard, rather
   * than a field quietly left off.
   *
   * Take a chain OFF this list the moment its logo lands in /public/chains.
   */
  it("keeps the list of chains with no logo explicit", () => {
    const noLogo = VISIBLE_CHAINS.filter(c => c.logo === undefined).map(c => c.name).sort()
    expect(noLogo).toEqual(["Mantle", "Plasma", "Unichain"])
  })

  // No em dashes in anything user-facing, and this file is entirely user-facing.
  it("uses no em dashes", () => {
    const text = VISIBLE_CHAINS.flatMap(c => [
      c.tagline, c.intro, c.metaDescription ?? "", c.builtFor ?? "",
      ...c.failures.flatMap(f => [f.title, f.detail]),
    ])
    expect(text.filter(t => /[—–]/.test(t))).toEqual([])
  })
})
