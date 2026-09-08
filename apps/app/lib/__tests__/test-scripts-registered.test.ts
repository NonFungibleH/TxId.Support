import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

/**
 * Every package holding tests must actually RUN them.
 *
 * `packages/solana` carried `errors.test.ts` and `lookup.test.ts` for weeks
 * with no `test` script in its package.json, so `turbo run test` skipped the
 * package entirely and CI was green on tests nobody was running. They passed
 * when finally run, which is the point: the failure here is silent by
 * construction, and a green board is exactly what it looks like.
 *
 * This is the same shape as rule 8 (dispatch a workflow by hand before
 * trusting its schedule) and the same shape as rule 7 (a test that cannot fail
 * has been shipped here twice). The guard is cheap; noticing is not.
 */
const ROOT = resolve(__dirname, "../../../..")

function testFileCount(dir: string): number {
  let n = 0
  const walk = (d: string) => {
    let entries: string[]
    try { entries = readdirSync(d) } catch { return }
    for (const e of entries) {
      if (e === "node_modules" || e === "dist" || e === ".next" || e === ".turbo") continue
      const p = join(d, e)
      let s
      try { s = statSync(p) } catch { continue }
      if (s.isDirectory()) walk(p)
      else if (/\.test\.tsx?$/.test(e)) n++
    }
  }
  walk(dir)
  return n
}

/**
 * The list above catches a package that has tests and does not RUN them. It is
 * blind to a package with no tests at all, which is a bigger hole and exactly
 * where `packages/ai` sat: 4,327 lines building every prompt and executing all
 * 27 tool arms, zero test files, invisible to the guard because the guard only
 * fires when files exist.
 *
 * So the packages whose code decides what a user is told are named here and
 * required to have tests. This is a floor, not a coverage target: it says the
 * suite exists and runs, nothing about how good it is.
 */
const MUST_HAVE_TESTS = [
  "packages/ai",         // prompts and tool dispatch
  "packages/blockchain", // every EVM read
  "packages/near", "packages/stellar", "packages/sui",
  "packages/aptos", "packages/solana", "packages/hyperliquid",
]

describe("the packages that decide what a user is told have tests at all", () => {
  it("each one has both a test script and at least one test", () => {
    const missing: string[] = []
    for (const dir of MUST_HAVE_TESTS) {
      const full = join(ROOT, dir)
      if (!existsSync(join(full, "package.json"))) { missing.push(`${dir} (no package)`); continue }
      const pkg = JSON.parse(readFileSync(join(full, "package.json"), "utf8")) as { scripts?: Record<string, string> }
      if (!pkg.scripts?.test) missing.push(`${dir} (no test script)`)
      else if (testFileCount(full) === 0) missing.push(`${dir} (no test files)`)
    }
    expect(missing).toEqual([])
  })
})

describe("every workspace that has tests runs them", () => {
  it("has no package with test files and no test script", () => {
    const unrun: string[] = []
    for (const group of ["packages", "apps"]) {
      const base = join(ROOT, group)
      if (!existsSync(base)) continue
      for (const name of readdirSync(base)) {
        const dir = join(base, name)
        const pkgPath = join(dir, "package.json")
        if (!existsSync(pkgPath)) continue
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> }
        if (pkg.scripts?.test) continue
        if (testFileCount(dir) > 0) unrun.push(`${group}/${name}`)
      }
    }
    // toEqual([]) with no exception list: an exception is how the next one hides.
    expect(unrun).toEqual([])
  })
})
