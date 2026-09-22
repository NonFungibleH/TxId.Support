import type { ActivationSpend } from "@/lib/types/config"

/**
 * The readiness checklist: what a new wallet has in place for its first core
 * action, and what it does not. PURE, so every sentence a user can read here is
 * pinned by a test and none of it depends on a network being up.
 *
 * ITS JOB IS CONFIDENCE. A new user who is about to sign their first
 * transaction wants to know three things: what is already fine, what to sort
 * first, and what the wallet is about to ask them. The "what to expect" items
 * exist for the third: an approve prompt nobody warned you about reads as a
 * scam, and that is where first attempts get abandoned.
 *
 * RULES CARRIED OVER FROM THE OPENER, ALL LOAD-BEARING:
 *
 * 1. ABSENCE IS NOT A FINDING. A read that did not complete is shown as
 *    "couldn't check", never as "you have none", and it is never counted as
 *    ready. A checklist that says "all set" because the balance read timed out
 *    is the bug this codebase has shipped before in other clothes.
 *
 * 2. FACTS ONLY. No amounts, nothing about what or how much to choose, no
 *    venue or bridge named. "Your USDC is on Arbitrum" is a fact about their
 *    wallet; "bridge it with X" is advice.
 */

export type Read<T> =
  | { kind: "ok"; value: T }
  /** We asked and did not get an answer. Says nothing about the wallet. */
  | { kind: "unavailable" }

export interface WalletFacts {
  /** The chain the wallet is on right now. Null when the connect did not say. */
  walletChain: { id: string; name: string } | null
  /** Native coin on the action's chain. `coversOneTx` is null when no fee estimate was available. */
  gas: Read<{ hasAny: boolean; coversOneTx: boolean | null }>
  /** Only for `spends: tokens`. `wanted` is the symbols the action takes; `elsewhere` only lists chains that were actually read. */
  asset: Read<{ held: string[]; wanted: string[]; elsewhere: { symbol: string; chainName: string }[] }> | null
  /** Only for held tokens, on EVM, when the spender contract is known. */
  approvals: Read<{ symbol: string; approved: boolean }[]> | null
  /** The first attempt that did not go through, when there is one. */
  failure:
    | { source: "history"; when: string | null; reason?: string }
    | { source: "host"; hash: string }
    | null
}

export interface ChecklistInput {
  projectName: string
  /** One word: "deposit", "swap", "lock", "stake". */
  action: string
  spends: ActivationSpend
  actionChain: { id: string; name: string; nativeSymbol: string; evm: boolean }
  facts: WalletFacts
}

export type ItemStatus = "ready" | "todo" | "expect" | "unknown"

export interface ChecklistItem {
  id: "failure" | "network" | "gas" | "asset" | "approval"
  status: ItemStatus
  title: string
  detail?: string
  /** A question to put in the chat, for items where the next step is a conversation. */
  ask?: string
}

export interface Checklist {
  headline: string
  ready: number
  /** Items that could be checked and are either ready or to do. Unknowns and heads-ups are not checks. */
  checkable: number
  todo: number
  items: ChecklistItem[]
}

const ORDER: Record<ItemStatus, number> = { ready: 0, todo: 1, expect: 2, unknown: 3 }
/** A checklist has at most five items, so its counts are always spelled out. */
const WORDS: Record<number, string> = { 2: "Two", 3: "Three", 4: "Four", 5: "Five" }

function orList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ""
  return `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`
}

function andList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ""
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`
}

export function failureItem(f: NonNullable<WalletFacts["failure"]>, projectName: string): ChecklistItem {
  if (f.source === "host") {
    return {
      id: "failure",
      status: "todo",
      title: "That transaction didn't go through",
      detail: "Ask and I'll look at exactly what happened.",
      ask: `Why did transaction ${f.hash} fail?`,
    }
  }
  const lead = f.when ? `It failed ${f.when}.` : ""
  const why = f.reason ?? "Ask and I'll look at exactly what happened."
  return {
    id: "failure",
    status: "todo",
    title: `Your last transaction on ${projectName} didn't go through`,
    detail: [lead, why].filter(Boolean).join(" "),
    ask: "Why did my last transaction fail?",
  }
}

function networkItem(input: ChecklistInput): ChecklistItem | null {
  const w = input.facts.walletChain
  if (!w) return null
  const target = input.actionChain
  if (w.id.toLowerCase() === target.id.toLowerCase()) {
    return { id: "network", status: "ready", title: `Connected to ${target.name}` }
  }
  return {
    id: "network",
    status: "todo",
    title: `Switch your wallet to ${target.name}`,
    detail: `Your wallet is on ${w.name}. ${input.projectName} runs on ${target.name}.`,
  }
}

function gasItem(input: ChecklistInput): ChecklistItem {
  const { nativeSymbol: sym, name: chain } = input.actionChain
  const native = input.spends.kind === "native"
  const g = input.facts.gas
  if (g.kind !== "ok") {
    return {
      id: "gas",
      status: "unknown",
      title: native ? `${sym} on ${chain}` : "Network fees",
      detail: `Couldn't check your ${sym} balance just now.`,
    }
  }
  // An unknown fee estimate is not "too little". Having some, with no estimate
  // to compare against, is reported as having some.
  const enough = g.value.hasAny && g.value.coversOneTx !== false
  if (native) {
    const both = `Here, both the ${input.action} itself and its network fee are paid in ${sym}`
    if (enough) return { id: "gas", status: "ready", title: `You have ${sym} on ${chain}`, detail: `${both}.` }
    if (!g.value.hasAny) {
      return { id: "gas", status: "todo", title: `Get ${sym} on ${chain}`, detail: `${both}, and this wallet has none on ${chain} yet.` }
    }
    return {
      id: "gas",
      status: "todo",
      title: `Top up ${sym} on ${chain}`,
      detail: `${both}. The ${sym} in this wallet is below the current network fee for one transaction.`,
    }
  }
  if (enough) return { id: "gas", status: "ready", title: `You have ${sym} for network fees` }
  if (!g.value.hasAny) {
    return {
      id: "gas",
      status: "todo",
      title: `Get ${sym} for network fees`,
      detail: `Every transaction on ${chain} pays its network fee in ${sym}, and this wallet has none there yet.`,
    }
  }
  return {
    id: "gas",
    status: "todo",
    title: `Top up ${sym} for network fees`,
    detail: `The ${sym} in this wallet is below the current network fee for one transaction on ${chain}.`,
  }
}

function assetItem(input: ChecklistInput): ChecklistItem | null {
  const a = input.facts.asset
  if (!a || input.spends.kind !== "tokens") return null
  const chain = input.actionChain.name
  if (a.kind !== "ok") {
    return {
      id: "asset",
      status: "unknown",
      title: `Tokens for your first ${input.action}`,
      detail: "Couldn't check your token balances just now.",
    }
  }
  const { held, wanted, elsewhere } = a.value
  if (held.length > 0) {
    return { id: "asset", status: "ready", title: `You hold ${andList(held.slice(0, 2))} on ${chain}` }
  }
  const away = elsewhere[0]
  if (away) {
    return {
      id: "asset",
      status: "todo",
      title: `Your ${away.symbol} is on ${away.chainName}`,
      detail: `It needs to be on ${chain} to ${input.action} here.`,
    }
  }
  // Only a claim about the action chain, whose read completed. Other chains
  // that failed to read were never looked at, so nothing is said about them.
  return {
    id: "asset",
    status: "todo",
    title: `Get ${orList(wanted.slice(0, 3))} on ${chain}`,
    detail: `Your first ${input.action} uses ${wanted.length > 1 ? "one of these" : "it"}, and this wallet doesn't hold any on ${chain} yet.`,
  }
}

function approvalItem(input: ChecklistInput): ChecklistItem | null {
  if (!input.actionChain.evm) return null
  if (input.spends.kind === "native") return null
  const permission = `It gives ${input.projectName}'s contract permission to use that token.`
  const generic: ChecklistItem = {
    id: "approval",
    status: "expect",
    title: "Your wallet may ask you to approve a token first",
    detail: `For most tokens that's a separate transaction before the ${input.action} itself, with its own network fee. ${permission}`,
  }
  const ap = input.facts.approvals
  // Nothing specific to check (any token, no known spender, or nothing held
  // yet): the heads-up still stands, because the approve prompt is the one a
  // first-time user is least ready for.
  if (input.spends.kind === "any" || !ap) return generic
  if (ap.kind !== "ok") {
    return {
      id: "approval",
      status: "unknown",
      title: "Token approval",
      detail: `Couldn't check whether your token is already approved for ${input.projectName}.`,
    }
  }
  if (ap.value.length === 0) return generic
  const missing = ap.value.filter(x => !x.approved).map(x => x.symbol)
  if (missing.length === 0) {
    return {
      id: "approval",
      status: "ready",
      title: `${andList(ap.value.map(x => x.symbol).slice(0, 2))} already approved for ${input.projectName}`,
    }
  }
  return {
    id: "approval",
    status: "expect",
    title: `Your wallet will ask you to approve ${orList(missing.slice(0, 2))} first`,
    detail: `That's a separate transaction before your first ${input.action}, with its own network fee. ${permission}`,
  }
}

export function buildChecklist(input: ChecklistInput): Checklist {
  const body = [networkItem(input), gasItem(input), assetItem(input), approvalItem(input)]
    .filter((x): x is ChecklistItem => x !== null)
    // Stable sort: within a status the order above holds.
    .map((item, i) => ({ item, i }))
    .sort((a, b) => ORDER[a.item.status] - ORDER[b.item.status] || a.i - b.i)
    .map(x => x.item)

  const items = input.facts.failure ? [failureItem(input.facts.failure, input.projectName), ...body] : body

  const ready = items.filter(i => i.status === "ready").length
  const todo = items.filter(i => i.status === "todo").length
  const unknown = items.filter(i => i.status === "unknown").length

  const headline =
    todo > 0
      ? `${todo === 1 ? "One thing" : `${WORDS[todo] ?? todo} things`} to sort before your first ${input.action}`
      : unknown > 0
        ? "Nothing to fix in what I could check"
        : `You're ready for your first ${input.action}`

  return { headline, ready, checkable: ready + todo, todo, items }
}
