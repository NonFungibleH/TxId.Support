import { PROTOCOL_ERRORS } from "./errmap"

/**
 * Why a NEAR transaction failed.
 *
 * NEAR IS THE ONLY CHAIN WE READ THAT HANDS OVER THE REASON ALREADY IN ENGLISH.
 * Every other one makes us work backwards from a number: a Solidity selector, a
 * Move abort code, a signed XDR result, a bare Anchor u32. A NEAR contract
 * panics with its own message and the runtime carries it verbatim.
 *
 * Measured on mainnet 2026-09-08, 149 transactions, 40 failures (26.8%):
 *
 *     21  v2.ref-finance.near   "panicked at 'E68: slippage error', ref-exchange/src/simple_pool.rs:313:9"
 *     16  game.hot.tg           "panicked at game_contract/src/lib.rs:439:9:\nMax supply reached"
 *      2  intents.near          "invalid intent"
 *      1  intents.near          "insufficient balance or overflow"
 *
 * All 40 arrived as ActionError/FunctionCallError/ExecutionError. That is one
 * shape, not four, and the honest floor covers the rest.
 *
 * SO WHAT IS LEFT FOR US TO DO? Two things. The message is wrapped in Rust
 * panic machinery a user must never see, and half of it is a code: `E68` means
 * nothing to somebody whose swap did not go through. Stripping the first and
 * translating the second is the entire job.
 */

export type NearErrorCause =
  /** The contract itself rejected the call and said why. */
  | "contract_panic"
  /** The method does not exist on that contract, or could not be resolved. */
  | "method_not_found"
  /** The contract ran out of gas. */
  | "out_of_gas"
  /** The transaction was refused before any contract ran. */
  | "invalid_transaction"
  /** An action-level failure the runtime named but that no contract produced. */
  | "action_error"
  /** Observed shape, no wording held. Stated, never guessed at. */
  | "unrecognised"

export interface DecodedNearError {
  cause: NearErrorCause
  /** The contract that failed, when the runtime named one. */
  contractId: string | null
  /** Which action of the transaction, zero-based. */
  actionIndex: number | null
  /**
   * The contract's own words with the Rust panic machinery removed, e.g.
   * "E68: slippage error". Null when nothing legible survived.
   */
  message: string | null
  /** A protocol's own short code, e.g. "E68", when the message carries one. */
  code: string | null
  /** Plain English. ALWAYS set. Says what is not known rather than inventing it. */
  reason: string
  /** True when we could not translate it and said so. */
  unrecognised: boolean
  /** The chain's failure object verbatim, so the record keeps what we were given. */
  raw: string
}

/**
 * Rust has changed its panic format, and near-sdk adds its own prefix, so the
 * same failure reaches us in three shapes. All three were observed live in one
 * 40-failure window, which is why this is a list rather than one regex.
 *
 * Order matters: the quoted form must be tried before the bare-prefix form, or
 * the latter swallows the whole string including the source path.
 */
const PANIC_PATTERNS: RegExp[] = [
  // Rust < 1.72: panicked at 'MESSAGE', src/file.rs:12:3
  /^Smart contract panicked:\s*panicked at\s*'([\s\S]+)',\s*[^\s,]+\.rs:\d+:\d+\s*$/,
  // Rust >= 1.72: panicked at src/file.rs:12:3:\nMESSAGE
  /^Smart contract panicked:\s*panicked at\s*[^\s,]+\.rs:\d+:\d+:\s*([\s\S]+)$/,
  // near-sdk's own env::panic_str, with no Rust wrapper at all.
  /^Smart contract panicked:\s*([\s\S]+)$/,
]

/**
 * The contract's own words, with the panic machinery stripped.
 *
 * A user must never be shown `ref-exchange/src/simple_pool.rs:313:9`. It is the
 * contract author's file layout, it looks like an internal error rather than
 * something they did, and it is the part of the string most likely to make
 * somebody think the protocol is broken when their swap simply moved on price.
 */
export function stripPanic(raw: string): string | null {
  const s = raw.trim()
  for (const p of PANIC_PATTERNS) {
    const m = p.exec(s)
    if (m?.[1]) return m[1].trim()
  }
  return s.length ? s : null
}

/** A leading protocol code, e.g. the "E68" in "E68: slippage error". */
function codeOf(message: string | null): string | null {
  if (!message) return null
  const m = /^([A-Z]{1,4}\d{1,4})\b\s*[:\-]?/.exec(message.trim())
  return m?.[1] ?? null
}

const asString = (v: unknown): string | null => (typeof v === "string" && v.length ? v : null)

interface FailureShape {
  ActionError?: { index?: number; kind?: Record<string, unknown> }
  InvalidTxError?: unknown
}

/**
 * Decode the runtime's failure object.
 *
 * `contractId` is passed in because the failure object DOES NOT NAME THE
 * CONTRACT. It gives an action index, and the receiver is a fact about the
 * transaction rather than the error. Attributing a panic to the wrong contract
 * is the NEAR version of Solana's instruction-index trap.
 */
export function decodeNearError(failure: unknown, contractId: string | null = null): DecodedNearError {
  const raw = typeof failure === "string" ? failure : JSON.stringify(failure ?? null)
  const f = (failure ?? {}) as FailureShape
  const base = { contractId, raw }

  const action = f.ActionError
  if (action && typeof action === "object") {
    const actionIndex = typeof action.index === "number" ? action.index : null
    const kind = action.kind ?? {}
    const kindName = Object.keys(kind)[0] ?? ""

    if (kindName === "FunctionCallError") {
      const fce = kind.FunctionCallError as Record<string, unknown>
      const inner = Object.keys(fce)[0] ?? ""

      if (inner === "ExecutionError") {
        const text = asString(fce.ExecutionError)
        // The runtime uses the same ExecutionError slot for running out of gas,
        // which is not a contract rejecting anything and needs a different fix.
        if (text && /exceeded the (prepaid|maximum amount of) gas/i.test(text)) {
          return {
            ...base, cause: "out_of_gas", actionIndex, message: text, code: null, unrecognised: false,
            reason: `The call ran out of gas before it finished${contractId ? ` on ${contractId}` : ""}. Nothing it was doing was saved, and the gas that was attached has been spent. Sending it again with more gas attached is the usual fix.`,
          }
        }
        const message = text ? stripPanic(text) : null
        const code = codeOf(message)
        const known = PROTOCOL_ERRORS[contractId ?? ""]?.[code ?? message ?? ""]
        if (known) {
          return { ...base, cause: "contract_panic", actionIndex, message, code, unrecognised: false, reason: known }
        }
        if (message) {
          // THE HONEST MIDDLE. We hold no translation, but the contract gave a
          // sentence, so quote it rather than invent one. This is why NEAR's
          // floor is higher than every other chain's: even unmapped, the user
          // gets the protocol's own words instead of a number.
          return {
            ...base, cause: "contract_panic", actionIndex, message, code, unrecognised: true,
            reason: `${contractId ? `The contract at ${contractId} rejected` : "The contract rejected"} the transaction and gave this reason: "${message}". Nothing was completed and only the gas was spent.`,
          }
        }
        return {
          ...base, cause: "unrecognised", actionIndex, message: null, code: null, unrecognised: true,
          reason: `${contractId ? `The contract at ${contractId} rejected` : "The contract rejected"} the transaction without giving a readable reason. Nothing was completed and only the gas was spent.`,
        }
      }

      if (inner === "MethodResolveError") {
        const detail = asString(fce.MethodResolveError)
        return {
          ...base, cause: "method_not_found", actionIndex, message: detail, code: null, unrecognised: false,
          reason: `The method this transaction tried to call does not exist on ${contractId ?? "that contract"}. That normally means the app called an older or newer version of the contract than the one deployed. Nothing was completed.`,
        }
      }

      if (inner === "HostError" || inner === "CompilationError" || inner === "LinkError") {
        return {
          ...base, cause: "action_error", actionIndex, message: asString(JSON.stringify(fce[inner])), code: null, unrecognised: true,
          reason: `The contract at ${contractId ?? "that address"} failed while running, in a way the runtime attributes to the contract's own code rather than to this transaction. Nothing was completed.`,
        }
      }
    }

    // Action-level failures the runtime names itself. Only wording we have
    // grounds for; anything else states the name and stops.
    const NAMED: Record<string, string> = {
      AccountDoesNotExist: "The account this transaction was sent to does not exist on NEAR. Account names are exact, so a single wrong character reaches a different account or none at all.",
      LackBalanceForState: "The account does not have enough NEAR left to cover the storage it is using. NEAR charges an account for the state it keeps, and the balance cannot fall below what its own data costs.",
      NotEnoughBalance: "There was not enough NEAR in the account to cover this transaction and the deposit it carried.",
      TriesToUnstake: "The account tried to unstake NEAR that is not currently staked.",
      TriesToStake: "The account tried to stake more NEAR than it holds.",
      CreateAccountNotAllowed: "The account name being created is not one this account is allowed to create.",
      ActorNoPermission: "The account that signed this does not have permission for the action it attempted.",
      DeleteAccountStaking: "The account cannot be deleted while it still has NEAR staked.",
    }
    if (kindName && NAMED[kindName]) {
      return {
        ...base, cause: "action_error", actionIndex, message: kindName, code: null, unrecognised: false,
        reason: NAMED[kindName]!,
      }
    }
    if (kindName) {
      return {
        ...base, cause: "action_error", actionIndex, message: kindName, code: null, unrecognised: true,
        reason: `NEAR refused this action and named the problem "${kindName}". We do not hold a plain-English description for that one, so this is the runtime's own wording rather than an interpretation of it.`,
      }
    }
  }

  if (f.InvalidTxError !== undefined) {
    const e = f.InvalidTxError
    const name = typeof e === "string" ? e : Object.keys((e ?? {}) as object)[0] ?? ""
    const NAMED: Record<string, string> = {
      InvalidNonce: "This transaction reused a number that had already been used by the account. That normally means two transactions were signed at once, or one was retried after it had already gone through. Check whether the first one succeeded before sending it again.",
      Expired: "This transaction sat unsent for too long and expired. Nothing was submitted, so it is safe to sign a new one.",
      NotEnoughBalance: "There was not enough NEAR in the account to cover this transaction's deposit and its gas.",
      InvalidSignature: "The signature on this transaction did not match the account that sent it.",
      SignerDoesNotExist: "The account that signed this transaction does not exist on NEAR.",
      InvalidReceiverId: "The account this transaction was addressed to is not a valid NEAR account name.",
      CostOverflow: "The amounts on this transaction were too large for NEAR to process.",
    }
    if (name && NAMED[name]) {
      return { ...base, cause: "invalid_transaction", actionIndex: null, message: name, code: null, unrecognised: false, reason: NAMED[name]! }
    }
    return {
      ...base, cause: "invalid_transaction", actionIndex: null, message: name || null, code: null, unrecognised: true,
      reason: `NEAR refused this transaction before running it${name ? `, naming the problem "${name}"` : ""}. Nothing was executed and nothing was charged.`,
    }
  }

  return {
    ...base, cause: "unrecognised", contractId, actionIndex: null, message: null, code: null, unrecognised: true,
    reason: "This transaction failed, and NEAR reported it in a form this decoder does not recognise. The raw result is kept so it can be read directly.",
  }
}
