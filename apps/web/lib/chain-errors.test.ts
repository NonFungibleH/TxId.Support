import { describe, it, expect } from "vitest"
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { explain, EXPLAINED_CONSTANTS } from "../../../packages/stellar/src/codes"
import { CODE_NAMES, RESULT_CODE_ENUM_FOR_OP } from "../../../packages/stellar/src/codes.generated"
import { SUI_ERRMAPS } from "../../../packages/sui/src/errmap"
import { PROGRAM_ERRMAPS } from "../../../packages/solana/src/errmap"
import { explainStatus, KNOWN_STATUSES } from "../../../packages/hyperliquid/src/statuses"

/**
 * Builds AND guards `chain-errors.generated.ts`.
 *
 * WHY THE PAGES USE A GENERATED FILE RATHER THAN IMPORTING THE PACKAGE:
 * apps/web depends on clsx, framer-motion, lucide-react, next and react, and
 * nothing else. Importing @txid/stellar so a marketing page can render a
 * lookup table would pull an entire chain stack into the public site's bundle.
 *
 * WHY IT IS GENERATED RATHER THAN TYPED: the hero chain strip on this site was
 * once a second, hand-maintained list, and it was missing Robinhood Chain
 * within an hour of that chain going live. Every error published here is the
 * same string the decoder itself uses, or the two have already drifted.
 *
 * This test is also the generator, because the repo has no TypeScript runner
 * installed and adding one to publish a table would be a poor trade:
 *
 *     UPDATE_CHAIN_ERRORS=1 pnpm --filter @txid/web test
 *
 * Without that variable it regenerates in memory and fails if the checked-in
 * file disagrees, which is what makes "single source of truth" a mechanism
 * rather than a comment.
 */

export interface ChainError {
  slug: string
  message: string
  chain: string
  scope: string | null
  code: number | null
  meaning: string
}

/** `txBAD_SEQ` -> `stellar-tx-bad-seq`. The URL is readable; the H1 stays exact. */
function slugify(chain: string, constant: string): string {
  const body = constant
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return `${chain}-${body}`
}

function scopeOf(constant: string): string | null {
  for (const [op, enumName] of Object.entries(RESULT_CODE_ENUM_FOR_OP)) {
    const codes = CODE_NAMES[enumName]
    if (codes && Object.values(codes).includes(constant)) return op
  }
  return null
}

function codeOf(constant: string): number | null {
  for (const codes of Object.values(CODE_NAMES)) {
    for (const [num, name] of Object.entries(codes)) if (name === constant) return Number(num)
  }
  return null
}

/**
 * The bar from errors.ts: "an entry we cannot explain properly does not ship:
 * thin pages hurt every other page here."
 *
 * It matters most on Solana, where PROGRAM_ERRMAPS holds the program's OWN
 * Anchor message alongside our English. "Empty route." and "Invalid
 * calculation." are what the program says, and they are useless to a user and
 * would make a page worth nothing. Only entries we have genuinely explained
 * get published; the rest still work in the product, they just do not earn a
 * page.
 */
const MIN_EXPLANATION = 80

function stellarErrors(): ChainError[] {
  const out: ChainError[] = []
  for (const constant of EXPLAINED_CONSTANTS) {
    const meaning = explain(constant)
    if (!meaning || meaning.length < MIN_EXPLANATION) continue
    out.push({
      slug: slugify("stellar", constant),
      message: constant,
      chain: "stellar",
      scope: scopeOf(constant),
      code: codeOf(constant),
      meaning,
    })
  }
  return out
}

/**
 * Sui is keyed `package::module`, and the package is a 66-character hex id that
 * would make a useless URL. The MODULE is the part a person recognises and the
 * part that appears in the abort they are looking at, so it carries the slug
 * and the package is dropped.
 */
function suiErrors(): ChainError[] {
  const out: ChainError[] = []
  for (const [qualified, codes] of Object.entries(SUI_ERRMAPS)) {
    const module = qualified.split("::").pop() ?? qualified
    for (const [code, entry] of Object.entries(codes)) {
      const e = entry as { name: string; reason: string }
      if (!e.reason || e.reason.length < MIN_EXPLANATION) continue
      out.push({
        slug: slugify("sui", `${module}-${e.name}`),
        message: e.name,
        chain: "sui",
        scope: module,
        code: Number(code),
        meaning: e.reason,
      })
    }
  }
  return out
}

/**
 * Solana errors are per PROGRAM, and the same code means different things in
 * different programs, so the program has to be part of the identity. The
 * address is 44 characters and unreadable, so the slug uses the error NAME and
 * the program is carried as scope: two programs defining `SlippageExceeded`
 * would otherwise collide, which the duplicate-slug test catches.
 */
function solanaErrors(): ChainError[] {
  const out: ChainError[] = []
  const seen = new Set<string>()
  for (const [program, codes] of Object.entries(PROGRAM_ERRMAPS)) {
    for (const [code, entry] of Object.entries(codes)) {
      const e = entry as { name: string; reason: string }
      if (!e.reason || e.reason.length < MIN_EXPLANATION) continue
      const slug = slugify("solana", e.name)
      // The same explained error genuinely recurs across programs (Jupiter's
      // 6001 and 6004 are both slippage). One page, not five near-identical
      // ones, which is the thin-page rule again in a different costume.
      if (seen.has(slug)) continue
      seen.add(slug)
      out.push({
        slug,
        message: e.name,
        chain: "solana",
        scope: program,
        code: Number(code),
        meaning: e.reason,
      })
    }
  }
  return out
}

/**
 * Hyperliquid statuses are already words rather than numbers, which is what
 * makes them worth publishing: nothing else on the internet explains
 * `minTradeNtlRejected`, and it was 640 of the 1,122 rejections measured
 * across 15,069 live orders.
 */
function hyperliquidErrors(): ChainError[] {
  const out: ChainError[] = []
  for (const status of KNOWN_STATUSES) {
    const { reason } = explainStatus(status)
    if (!reason || reason.length < MIN_EXPLANATION) continue
    out.push({
      slug: slugify("hyperliquid", status),
      message: status,
      chain: "hyperliquid",
      scope: null,
      code: null,
      meaning: reason,
    })
  }
  return out
}

function build(): ChainError[] {
  return [...stellarErrors(), ...suiErrors(), ...solanaErrors(), ...hyperliquidErrors()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

function render(errors: ChainError[]): string {
  return `// GENERATED by chain-errors.test.ts. Do not edit by hand.
//
// Every entry is the SAME string the decoder uses, read from the chain
// packages rather than retyped, so a published page cannot describe an error
// differently from the product. The test that wrote this file fails if the two
// ever disagree.
//
// Regenerate: UPDATE_CHAIN_ERRORS=1 pnpm --filter @txid/web test

export interface ChainError {
  slug: string
  /** The exact constant a wallet, explorer or SDK shows. The page H1. */
  message: string
  chain: string
  /** The operation the code belongs to, when it is operation-level. */
  scope: string | null
  /** Its signed number within its enum, which is what raw XDR carries. */
  code: number | null
  meaning: string
}

export const CHAIN_ERRORS: ChainError[] = ${JSON.stringify(errors, null, 2)}
`
}

const TARGET = resolve(__dirname, "chain-errors.generated.ts")

describe("the published chain errors come from the decoder, not from a copy", () => {
  const built = build()

  it("produces a real catalogue, so the check cannot pass vacuously", () => {
    expect(built.length).toBeGreaterThan(40)
    for (const e of built) {
      expect(e.slug, e.message).toMatch(/^[a-z0-9-]+$/)
      expect(e.meaning.length, e.message).toBeGreaterThanOrEqual(80)
    }
  })

  it("has no duplicate slugs, which would collide as URLs", () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const e of built) {
      const prev = seen.get(e.slug)
      if (prev) dupes.push(`${e.slug}: ${prev} and ${e.message}`)
      seen.set(e.slug, e.message)
    }
    expect(dupes).toEqual([])
  })

  // Site-wide rule, and these strings are entirely user-facing.
  it("uses no em dashes", () => {
    expect(built.filter(e => e.meaning.includes("—")).map(e => e.message)).toEqual([])
  })

  it("matches the checked-in generated file", () => {
    const next = render(built)
    if (process.env.UPDATE_CHAIN_ERRORS === "1") {
      writeFileSync(TARGET, next)
      return
    }
    expect(existsSync(TARGET), "chain-errors.generated.ts is missing; run with UPDATE_CHAIN_ERRORS=1").toBe(true)
    expect(readFileSync(TARGET, "utf8")).toBe(next)
  })
})
