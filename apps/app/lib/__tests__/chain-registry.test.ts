import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { CHAIN_CONFIGS } from "@txid/blockchain"
import { SUPPORTED_CHAINS } from "@/lib/types/config"

/**
 * Adding a chain touches SIX places, and until now the only thing enforcing
 * that was a sentence in CLAUDE.md.
 *
 *   packages/blockchain/src/types.ts      CHAIN_CONFIGS
 *   packages/blockchain/src/blockscout.ts ETHERSCAN_CHAIN_IDS / BLOCKSCOUT_BASES
 *   apps/app/lib/types/config.ts          SUPPORTED_CHAINS
 *   packages/ai/src/prompt.ts             CHAIN_NAMES
 *   apps/app/components/.../ConversationList.tsx  CHAIN_NAMES
 *   apps/web/lib/chains.ts                the public chain page
 *
 * MISSING ONE IS SILENT. A chain absent from a CHAIN_NAMES map does not error;
 * the model is simply handed a hex id instead of a name and talks to the user
 * about "chain 0x2611". A chain absent from apps/web has no page and no entry
 * in the count. Nothing fails, nothing logs, and it is found weeks later, if at
 * all. `DEFAULT_CHAINS` was exactly this: a hand-written list that omitted
 * Etherlink, so the API's auto-detect never searched it.
 *
 * Four chains were added by hand from that checklist on 2026-09-08. This is
 * what should have been checking it.
 */
const ROOT = resolve(__dirname, "../../../..")
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8")

const PROMPT = read("packages/ai/src/prompt.ts")
const CONVERSATIONS = read("apps/app/components/dashboard/ConversationList.tsx")
const WEB_CHAINS = read("apps/web/lib/chains.ts")

/** The CHAIN_NAMES maps are private consts, so consistency is checked as text. */
const namedInPrompt = (id: string) => new RegExp(`"${id}"\\s*:`).test(PROMPT)
const namedInConversations = (id: string) => new RegExp(`"${id}"\\s*:`).test(CONVERSATIONS)

describe("every EVM chain we can read is registered everywhere it has to be", () => {
  /**
   * CHAIN_CONFIGS carries BOTH forms of every id: "0x1" and "1". That is the
   * #69 fix, where a decimal chain id silently resolved to Ethereum, and the
   * aliases exist so a caller sending either is understood. Only the canonical
   * hex form is checked here; requiring both everywhere would demand decimal
   * entries nothing reads.
   */
  const evmIds = Object.keys(CHAIN_CONFIGS).filter(id => id.startsWith("0x"))

  it("finds the registry at all, so this cannot pass vacuously", () => {
    expect(evmIds.length).toBeGreaterThan(8)
    expect(PROMPT.length + CONVERSATIONS.length + WEB_CHAINS.length).toBeGreaterThan(1000)
  })

  it("is offered in the dashboard's chain list", () => {
    const supported = new Set<string>(SUPPORTED_CHAINS.map(c => c.id as string))
    expect(evmIds.filter(id => !supported.has(id))).toEqual([])
  })

  /**
   * Without a name the model is handed a raw hex id and tells the user about
   * "chain 0x2611", which is the sort of detail that makes an assistant sound
   * like a database.
   */
  it("has a human name in the prompt's map", () => {
    expect(evmIds.filter(id => !namedInPrompt(id))).toEqual([])
  })

  it("has a human name in the conversations list", () => {
    expect(evmIds.filter(id => !namedInConversations(id))).toEqual([])
  })
})

describe("every EVM chain the dashboard offers can actually be read", () => {
  /**
   * The check above is CHAIN_CONFIGS then SUPPORTED_CHAINS. This is the other
   * direction, and it was missing: a chain a user can select that has no
   * config is a chain we offer and cannot read.
   *
   * Sepolia was exactly this. It sat in SUPPORTED_CHAINS with an entry in the
   * explorer map and none in CHAIN_CONFIGS, so `getNetworkStatus` reported a
   * healthy testnet as one that "may be having issues" and every Sepolia
   * revert came back "Reverted by the smart contract." without anything being
   * read. Nothing failed; there was simply no node to ask.
   */
  it("has an entry in CHAIN_CONFIGS with an rpcUrl", () => {
    const configs = CHAIN_CONFIGS as Record<string, { rpcUrl?: string } | undefined>
    const broken = SUPPORTED_CHAINS
      .map(c => String(c.id))
      .filter(id => id.startsWith("0x"))
      .filter(id => !configs[id]?.rpcUrl)
    expect(broken).toEqual([])
  })
})

describe("every chain the dashboard offers has a public page", () => {
  /**
   * A chain a customer can select but that has no page on the marketing site
   * is a chain we support and do not claim to, which is the harmless direction
   * of the same inconsistency, and still worth catching: the count on the
   * homepage is derived from that file.
   */
  it("appears in apps/web/lib/chains.ts", () => {
    const missing = SUPPORTED_CHAINS
      // A testnet is offered for development and has nothing to sell, so it
      // deliberately has no marketing page.
      .filter(c => !/testnet/i.test(c.name))
      .filter(c => {
        // Match on the NAME, since the web file keys on slug rather than id.
        const name = c.name.replace(/[^A-Za-z]/g, "")
        return !new RegExp(`name:\\s*"${c.name}"`).test(WEB_CHAINS) &&
               !new RegExp(`slug:\\s*"${name.toLowerCase()}"`).test(WEB_CHAINS)
      })
      .map(c => `${c.name} (${c.id})`)
    expect(missing).toEqual([])
  })
})

describe("the non-EVM chains are registered too", () => {
  /**
   * These are not in CHAIN_CONFIGS, which holds EVM chains only, so they would
   * fall outside every check above. They are named explicitly rather than
   * derived, because there is no single registry that contains them: that IS
   * the shape of the problem this file guards.
   */
  /**
   * DERIVED, not a second list. This was hand-written, and a hand-written list
   * of the chains that a hand-written list might miss is the same bug one
   * level up: adding a non-EVM chain and forgetting to add it here would leave
   * it unchecked by every test in this file.
   *
   * An id that is not hex is not an EVM chain id, so this is the whole set by
   * construction.
   */
  const NON_EVM = SUPPORTED_CHAINS.map(c => String(c.id)).filter(id => !id.startsWith("0x"))

  it("is a set this file actually derived, so it cannot pass vacuously", () => {
    expect(NON_EVM.length).toBeGreaterThan(3)
  })

  it("each is offered, named in both maps, and has a page", () => {
    const supported = new Set<string>(SUPPORTED_CHAINS.map(c => c.id as string))
    const problems: string[] = []
    for (const id of NON_EVM) {
      if (!supported.has(id)) problems.push(`${id}: not in SUPPORTED_CHAINS`)
      if (!namedInPrompt(id)) problems.push(`${id}: no name in prompt.ts`)
      if (!namedInConversations(id)) problems.push(`${id}: no name in ConversationList`)
      if (!new RegExp(`slug:\\s*"${id}"`).test(WEB_CHAINS)) problems.push(`${id}: no page in apps/web`)
    }
    expect(problems).toEqual([])
  })
})

describe("nothing is paused", () => {
  /**
   * PAUSED_CHAINS is empty as of 2026-09-08 and SELECTABLE_CHAINS is therefore
   * the whole list. If a chain is ever paused again this fails, which is the
   * point: pausing one should be a deliberate, visible act rather than a line
   * nobody notices, and the last one sat paused on a credential that turned out
   * not to be needed.
   */
  it("so every supported chain is selectable", async () => {
    const { SELECTABLE_CHAINS } = await import("@/lib/types/config")
    expect(SELECTABLE_CHAINS.length).toBe(SUPPORTED_CHAINS.length)
  })
})
