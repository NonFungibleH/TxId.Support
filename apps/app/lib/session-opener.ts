import { getRecentTransactions } from "@txid/blockchain"
import { getAptosRecentTransactions, isAptosChain } from "@txid/aptos"
import type { ProjectConfig } from "@/lib/types/config"
import { resolveProtocolAccount } from "@/lib/protocol-account"

/**
 * What to say the moment a wallet connects, instead of "I can look up your
 * balance and transactions now".
 *
 * That line announced a capability rather than using it, at the one moment the
 * user has told us exactly who they are. If their last transaction failed four
 * minutes ago we already know why, and asking whether they would like help
 * with it makes them say yes before we do the thing we could have just done.
 *
 * THREE RULES, ALL LOAD-BEARING:
 *
 * 1. NO AMOUNTS. "Your last swap didn't go through" is helpful; "you're down
 *    $312" unprompted is surveillance, and it is on someone's screen in a
 *    coffee shop. Amounts are fine the moment they engage.
 *
 * 2. NOTHING EVALUATIVE. The no-advice guardrail applies harder here, because
 *    unsolicited financial commentary is a stronger form of advice than
 *    answering a question. State facts, never judgements.
 *
 * 3. SILENCE IS A VALID OUTPUT. A failed lookup, or nothing interesting
 *    happening, returns null and the normal greeting stands. This codebase has
 *    already told an active trader they had never traded because a throttled
 *    read was rendered as an answer. Volunteering that unprompted is worse.
 */

export type OpenerScenario =
  /** Their most recent transaction with this protocol failed. */
  | "recent_failure"
  /** They have interacted, and nothing is obviously wrong. */
  | "active"
  /** Connected, but has never touched this protocol. Activation, not support. */
  | "no_activity"

export interface SessionOpener {
  scenario: OpenerScenario
  message: string
  /** Tappable suggestions, so the path to help costs no typing. */
  chips: string[]
}

/** Recent enough that they are probably still looking at it. */
const FRESH_MS = 24 * 60 * 60 * 1000

function ago(timestamp: string | number): string | null {
  const t = typeof timestamp === "number" ? timestamp : Date.parse(timestamp)
  if (!Number.isFinite(t)) return null
  const mins = Math.floor((Date.now() - t) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

/** Shared shape so both chain families reduce to the same decision. */
interface Recent {
  failed: boolean
  when: string | null
  freshMs: number
  /** A plain-English cause when the decoder produced one. */
  reason?: string
}

async function recentAptos(config: ProjectConfig, address: string): Promise<Recent[] | null> {
  const watched = (config.watchedContracts ?? []).find(c => c.chain === "aptos")
  const txs = await getAptosRecentTransactions(address, watched?.address, 5).catch(() => null)
  // null is a FAILED LOOKUP, not an empty history. The distinction is the whole
  // reason this returns null rather than [].
  if (txs === null) return null
  return txs.map(t => ({
    failed: !t.success,
    when: ago(t.timestamp),
    freshMs: Date.now() - (Date.parse(t.timestamp) || 0),
    ...(t.decodedAbort?.reason ? { reason: t.decodedAbort.reason } : {}),
  }))
}

async function recentEvm(_config: ProjectConfig, address: string, chainId: string): Promise<Recent[] | null> {
  const txs = await getRecentTransactions(address, chainId, 5).catch(() => null)
  if (!txs) return null
  return txs.map(t => ({
    failed: t.status === "failed",
    when: ago(t.timestamp),
    freshMs: Date.now() - (Date.parse(t.timestamp) || 0),
    ...(t.decodedRevert?.reason ? { reason: t.decodedRevert.reason } : {}),
  }))
}

/**
 * NOT AN LLM CALL, deliberately. This runs the moment a wallet connects, which
 * is the exact moment that has to feel instant, and it would cost money for
 * every user who never asks anything. The scenarios are enumerable, so rules
 * over one cheap read are faster, cheaper and predictable.
 *
 * NOT INCLUDED: "your transaction is stuck". Detecting an unconfirmed
 * transaction needs a hash or mempool access, and the history endpoints return
 * only mined transactions. It would have to be volunteered wrongly or not at
 * all, so it is not at all.
 */
export async function buildSessionOpener(
  config: ProjectConfig,
  address: string,
  chainId: string,
  projectName: string,
): Promise<SessionOpener | null> {
  const recent = isAptosChain(chainId)
    ? await recentAptos(config, address)
    : await recentEvm(config, address, chainId)

  // Could not find out. Say nothing at all.
  if (recent === null) return null

  if (recent.length === 0) {
    // A wallet that has never touched this protocol is not a support case, it
    // is someone stuck before their first transaction. Different job.
    const account = await resolveProtocolAccount(config, address).catch(() => ({ status: "off" as const }))
    if (account.status === "failed") return null
    return {
      scenario: "no_activity",
      message:
        `No activity on ${projectName} from this wallet yet. ` +
        `If you are getting set up, I can walk you through the first steps or check whether your wallet is ready.`,
      chips: [
        "How do I get started?",
        "Is my wallet ready?",
        "What do I need before my first transaction?",
      ],
    }
  }

  const failure = recent.find(r => r.failed && r.freshMs < FRESH_MS)
  if (failure) {
    // Lead with the finding, not an offer to go and find it. The reason is
    // already decoded, so withholding it to ask permission wastes the turn.
    const cause = failure.reason ? ` ${failure.reason}` : ""
    return {
      scenario: "recent_failure",
      message:
        `Your last transaction on ${projectName} ${failure.when ?? "recently"} did not go through.` +
        `${cause}` +
        ` I can take you through exactly what happened and what to do next.`,
      chips: ["Why did it fail?", "What should I do now?", "Did it cost me anything?"],
    }
  }

  const last = recent[0]
  return {
    scenario: "active",
    message:
      `I can see your recent activity on ${projectName}` +
      `${last?.when ? `, the latest ${last.when}` : ""}. ` +
      `Ask me about any of it, or anything else about the protocol.`,
    chips: ["Explain my last transaction", "Show my recent activity"],
  }
}
