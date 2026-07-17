/**
 * "Actions" tools: prepare unsigned transactions the USER signs in their own
 * wallet. Execute-only by design — these tools carry out an explicitly stated
 * user request; the assistant never proposes or recommends transactions.
 *
 * Policy lives with the caller (apps/app): these tools only exist on a request
 * when the chat route passes an ActionsContext (project toggle + plan + geo
 * checks already passed). OFAC screening happens here, per invocation,
 * fail-closed. DB writes stay in apps/app via the persistAction callback.
 */

import type Anthropic from "@anthropic-ai/sdk"
import {
  checkSanctioned,
  NATIVE_TOKEN,
  MAJOR_TOKENS,
  toRawAmount,
  fromRawAmount,
  getTokenDecimals,
  getAllowance,
  buildApproveTx,
  preflightTx,
  kyberQuote,
  kyberBuild,
  usdValueOf,
  encodeContractAction,
} from "@txid/blockchain"
import type { WatchedContractSnapshot } from "./types"
import type { WalletConfig } from "./tools"

export interface ActionsFunctionRule {
  fn: string
  approval?: { token: string; amountArg: number }
}

export interface ActionsContext {
  /** contractId → enabled write functions. */
  allowedFunctions: Record<string, ActionsFunctionRule[]>
  /** Per-swap USD ceiling; 0 disables swaps. */
  maxSwapUsd: number
  projectToken: { address: string; symbol: string; chain: string } | null
  /** Persists the prepared action (apps/app owns the DB). Must not throw. */
  persistAction: (record: {
    id: string
    kind: "contract_action" | "swap"
    chainId: string
    summary: string
    params: Record<string, unknown>
  }) => Promise<void>
}

export interface ActionPayload {
  id: string
  kind: "contract_action" | "swap"
  chainId: string
  summary: string
  originNote: string
  approval?: { to: string; data: string; value: string; token: string; amount: string }
  tx?: { to: string; data: string; value: string; gas?: string }
  expiresAt?: number
  swapMeta?: { fromToken: string; toToken: string; fromAmount: string; minReceived: string }
}

const SWAP_TTL_MS = 60_000
const ORIGIN_NOTE = "Your wallet will show this request from app.txid.support (TxID powers this protocol's support)."

const REFUSED_SCREENING =
  "I can't prepare transactions for this wallet right now. You can still ask me anything about the protocol."

/** Fail-closed OFAC screen: sanctioned OR unreachable oracle → refuse. */
async function screeningPasses(address: string): Promise<boolean> {
  const result = await checkSanctioned(address)
  return result !== null && result.sanctioned === false
}

function resolveToken(
  ref: string,
  chainId: string,
  projectToken: ActionsContext["projectToken"],
): { address: string; symbol: string } | null {
  const trimmed = ref.trim()
  const majors = MAJOR_TOKENS[chainId] ?? {}
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    const lower = trimmed.toLowerCase()
    for (const [symbol, address] of Object.entries(majors)) {
      if (address.toLowerCase() === lower) return { address, symbol }
    }
    if (projectToken && projectToken.chain === chainId && projectToken.address.toLowerCase() === lower) {
      return { address: projectToken.address, symbol: projectToken.symbol }
    }
    return null
  }
  const upper = trimmed.toUpperCase()
  if (majors[upper]) return { address: majors[upper], symbol: upper }
  if (projectToken && projectToken.chain === chainId && projectToken.symbol.toUpperCase() === upper) {
    return { address: projectToken.address, symbol: projectToken.symbol }
  }
  return null
}

// ── Tool definitions ────────────────────────────────────────────────────────

export function buildPrepareContractActionTool(
  ctx: ActionsContext,
  watchedContracts: WatchedContractSnapshot[],
): Anthropic.Tool | null {
  const enabled = watchedContracts.filter(c => (ctx.allowedFunctions[c.id] ?? []).length > 0)
  if (enabled.length === 0) return null
  const catalogue = enabled
    .map(c => `${c.name}: ${(ctx.allowedFunctions[c.id] ?? []).map(r => r.fn).join(", ")}`)
    .join("; ")
  return {
    name: "prepare_contract_action",
    description:
      "Prepare a protocol contract transaction the user EXPLICITLY asked to make (e.g. lock, stake, claim), for review and signing in their own wallet. " +
      "Only for carrying out the user's stated request — never propose or suggest transactions the user did not ask for. " +
      `Available functions — ${catalogue}. ` +
      "Amounts are human units (e.g. \"100\" tokens); pass all function arguments in order as strings.",
    input_schema: {
      type: "object" as const,
      properties: {
        contract: { type: "string", description: "Watched contract name" },
        function: { type: "string", description: "Function name from the available list" },
        args: { type: "array", items: { type: "string" }, description: "All arguments, in ABI order, as strings" },
      },
      required: ["contract", "function", "args"],
    },
  }
}

export function buildPrepareSwapTool(ctx: ActionsContext): Anthropic.Tool | null {
  if (ctx.maxSwapUsd <= 0) return null
  return {
    name: "prepare_swap",
    description:
      "Prepare a token swap the user EXPLICITLY asked to make, for review and signing in their own wallet. " +
      "Only for carrying out the user's stated request — never propose, suggest, or recommend swaps or tokens. " +
      "Supported tokens: the protocol's token and major tokens (native coin, wrapped native, USDC, USDT, DAI) on the connected chain.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_token: { type: "string", description: "Token to sell: symbol (e.g. USDC) or address" },
        to_token: { type: "string", description: "Token to buy: symbol or address" },
        amount: { type: "string", description: "Human amount of from_token to sell, e.g. \"10\" or \"0.5\"" },
      },
      required: ["from_token", "to_token", "amount"],
    },
  }
}

// ── Execution ───────────────────────────────────────────────────────────────

export async function executeActionTool(
  name: string,
  input: Record<string, unknown>,
  wallet: WalletConfig,
  watchedContracts: WatchedContractSnapshot[],
  ctx: ActionsContext,
): Promise<unknown> {
  if (!(await screeningPasses(wallet.address))) return { refused: REFUSED_SCREENING }

  if (name === "prepare_swap") {
    return prepareSwap(
      { fromToken: String(input.from_token ?? ""), toToken: String(input.to_token ?? ""), amount: String(input.amount ?? "") },
      wallet,
      ctx,
    )
  }
  if (name === "prepare_contract_action") {
    return prepareContractAction(
      { contract: String(input.contract ?? ""), fn: String(input.function ?? ""), args: (input.args as string[] | undefined) ?? [] },
      wallet,
      watchedContracts,
      ctx,
    )
  }
  return { error: "Unknown action tool" }
}

export interface SwapParams { fromToken: string; toToken: string; amount: string }

/** Shared by the tool and the rebuild endpoint. */
export async function prepareSwap(
  params: SwapParams,
  wallet: WalletConfig,
  ctx: ActionsContext,
  existingId?: string,
): Promise<Record<string, unknown>> {
  const chainId = wallet.chainId
  const from = resolveToken(params.fromToken, chainId, ctx.projectToken)
  const to = resolveToken(params.toToken, chainId, ctx.projectToken)
  if (!from || !to) {
    return { error: "That token isn't available for swaps here. Supported: the protocol's token and majors (native, wrapped, USDC, USDT, DAI) on the connected chain." }
  }
  if (from.address.toLowerCase() === to.address.toLowerCase()) return { error: "Those are the same token." }

  const decimals = await getTokenDecimals(from.address, chainId)
  if (decimals === null) return { error: "Couldn't read that token's decimals right now — please try again." }
  let amountRaw: bigint
  try { amountRaw = toRawAmount(params.amount, decimals) } catch (e) { return { error: e instanceof Error ? e.message : "Invalid amount" } }
  if (amountRaw <= 0n) return { error: "The amount must be greater than zero." }

  const quote = await kyberQuote(chainId, from.address, to.address, amountRaw.toString())
  if ("error" in quote) return { error: quote.error }

  const usd = await usdValueOf(quote.amountInUsd, from.address, chainId, params.amount)
  if (usd === null) return { error: "Couldn't price this swap in USD, so I can't prepare it (a safety limit applies). Try a major token pair." }
  if (usd > ctx.maxSwapUsd) return { error: `This swap (~$${usd.toFixed(0)}) is over this protocol's per-swap limit of $${ctx.maxSwapUsd}.` }

  const id = existingId ?? crypto.randomUUID()
  const summaryBase = `Swap ${params.amount} ${from.symbol} for ${to.symbol}`

  // ERC-20 sell: allowance gate. Approval-gated payloads defer the swap tx to
  // the rebuild endpoint (post-approval), so the quote is never stale at sign.
  if (from.address.toLowerCase() !== NATIVE_TOKEN.toLowerCase()) {
    const allowance = await getAllowance(from.address, wallet.address, quote.routerAddress, chainId)
    if (allowance === null) return { error: "Couldn't check the token allowance right now — please try again." }
    if (allowance < amountRaw) {
      const approveTx = buildApproveTx(from.address, quote.routerAddress, amountRaw)
      const pf = await preflightTx(chainId, wallet.address, approveTx.to, approveTx.data)
      if (!pf || pf.wouldFail) {
        return { error: `The required token approval would fail right now${pf?.revertReason ? `: ${pf.revertReason}` : ""}.` }
      }
      const payload: ActionPayload = {
        id, kind: "swap", chainId,
        summary: `${summaryBase} (step 1: approve ${params.amount} ${from.symbol})`,
        originNote: ORIGIN_NOTE,
        approval: { ...approveTx, token: from.symbol, amount: params.amount },
      }
      await ctx.persistAction({ id, kind: "swap", chainId, summary: summaryBase, params: { ...params } })
      return {
        prepared: true, needsApproval: true, summary: payload.summary,
        note: "An exact-amount approval is required first. After it confirms, the swap will be rebuilt with a fresh quote.",
        clientAction: payload,
      }
    }
  }

  const built = await kyberBuild(chainId, quote.routeSummary, wallet.address)
  if ("error" in built) return { error: built.error }
  const pf = await preflightTx(chainId, wallet.address, built.to, built.data, built.value)
  if (!pf || pf.wouldFail) {
    return { error: `This swap would fail right now${pf?.revertReason ? `: ${pf.revertReason}` : ""}.` }
  }

  const toDecimals = await getTokenDecimals(to.address, chainId)
  const minReceived = toDecimals !== null ? fromRawAmount(built.minAmountOut, toDecimals) : built.minAmountOut
  const payload: ActionPayload = {
    id, kind: "swap", chainId,
    summary: summaryBase,
    originNote: ORIGIN_NOTE,
    tx: { to: built.to, data: built.data, value: built.value, ...(pf.gas ? { gas: pf.gas } : {}) },
    expiresAt: Date.now() + SWAP_TTL_MS,
    swapMeta: { fromToken: from.symbol, toToken: to.symbol, fromAmount: params.amount, minReceived },
  }
  if (!existingId) await ctx.persistAction({ id, kind: "swap", chainId, summary: summaryBase, params: { ...params } })
  return {
    prepared: true, needsApproval: false, summary: summaryBase,
    minReceived: `${minReceived} ${to.symbol}`, approxUsd: usd.toFixed(2),
    note: "The user must review and sign in their own wallet. The quote expires in 60 seconds.",
    clientAction: payload,
  }
}

export interface ContractActionParams { contract: string; fn: string; args: string[] }

/** Shared by the tool and the rebuild endpoint. */
export async function prepareContractAction(
  params: ContractActionParams,
  wallet: WalletConfig,
  watchedContracts: WatchedContractSnapshot[],
  ctx: ActionsContext,
  existingId?: string,
): Promise<Record<string, unknown>> {
  const contract = watchedContracts.find(
    c => c.name.toLowerCase() === params.contract.toLowerCase() || c.address.toLowerCase() === params.contract.toLowerCase(),
  )
  if (!contract) return { error: `No watched contract named "${params.contract}".` }
  if (contract.chain !== wallet.chainId) {
    return { error: `${contract.name} lives on a different network than the connected wallet. Ask the user to switch networks first.` }
  }
  const rules = ctx.allowedFunctions[contract.id] ?? []
  const rule = rules.find(r => r.fn.toLowerCase() === params.fn.toLowerCase())
  if (!rule) return { error: `"${params.fn}" is not enabled for wallet actions on ${contract.name}.` }
  if (!contract.abi) return { error: `${contract.name} has no ABI stored, so I can't prepare this transaction.` }

  const encoded = encodeContractAction(contract.address, rule.fn, params.args, contract.abi)
  if ("error" in encoded) return { error: encoded.error }

  const id = existingId ?? crypto.randomUUID()
  const summary = `${encoded.fnName}(${params.args.join(", ")}) on ${contract.name}`

  if (rule.approval) {
    const amountHuman = params.args[rule.approval.amountArg]
    if (amountHuman === undefined) return { error: "Missing the amount argument for this action." }
    const decimals = await getTokenDecimals(rule.approval.token, wallet.chainId)
    if (decimals === null) return { error: "Couldn't read the token's decimals right now — please try again." }
    let amountRaw: bigint
    try { amountRaw = toRawAmount(amountHuman, decimals) } catch (e) { return { error: e instanceof Error ? e.message : "Invalid amount" } }
    const allowance = await getAllowance(rule.approval.token, wallet.address, contract.address, wallet.chainId)
    if (allowance === null) return { error: "Couldn't check the token allowance right now — please try again." }
    if (allowance < amountRaw) {
      const approveTx = buildApproveTx(rule.approval.token, contract.address, amountRaw)
      const pf = await preflightTx(wallet.chainId, wallet.address, approveTx.to, approveTx.data)
      if (!pf || pf.wouldFail) {
        return { error: `The required token approval would fail right now${pf?.revertReason ? `: ${pf.revertReason}` : ""}.` }
      }
      const payload: ActionPayload = {
        id, kind: "contract_action", chainId: wallet.chainId,
        summary: `${summary} (step 1: approve ${amountHuman} tokens)`,
        originNote: ORIGIN_NOTE,
        approval: { ...approveTx, token: rule.approval.token, amount: amountHuman },
      }
      await ctx.persistAction({ id, kind: "contract_action", chainId: wallet.chainId, summary, params: { ...params } })
      return {
        prepared: true, needsApproval: true, summary: payload.summary,
        note: "An exact-amount approval is required first. After it confirms, the action itself will be prepared.",
        clientAction: payload,
      }
    }
  }

  const pf = await preflightTx(wallet.chainId, wallet.address, encoded.to, encoded.data)
  if (!pf || pf.wouldFail) {
    return { error: `This action would fail right now${pf?.revertReason ? `: ${pf.revertReason}` : ""}. I can help diagnose why.` }
  }

  const payload: ActionPayload = {
    id, kind: "contract_action", chainId: wallet.chainId,
    summary,
    originNote: ORIGIN_NOTE,
    tx: { to: encoded.to, data: encoded.data, value: "0x0", ...(pf.gas ? { gas: pf.gas } : {}) },
  }
  if (!existingId) await ctx.persistAction({ id, kind: "contract_action", chainId: wallet.chainId, summary, params: { ...params } })
  return {
    prepared: true, needsApproval: false, summary,
    note: "The user must review and sign in their own wallet.",
    clientAction: payload,
  }
}
