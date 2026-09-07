import { PROGRAM_ERRMAPS } from "./errmap"
/**
 * What a failed Solana transaction actually says, and what it means.
 *
 * Solana hands a client two things and neither is an explanation: an `err`
 * object that names an instruction index and a NUMBER, and a pile of program
 * logs. The number is the whole message. This is why "custom program error:
 * 0x1771" is a joke in the ecosystem: it is Jupiter telling a user their
 * slippage was exceeded, and nothing anywhere says so.
 *
 * BUILT FROM REAL TRAFFIC (164 failed mainnet transactions, 2026-09-07):
 *   InstructionError: Custom             90%
 *   InstructionError: ProgramFailedToComplete  8%
 *   InstructionError: ComputationalBudgetExceeded 2%
 * and 9.5% of ALL transactions in a sampled slot had failed, which is roughly
 * twenty times the rate we measured on Aptos.
 *
 * TWO THINGS THE `err` OBJECT DOES NOT TELL YOU, both of which the logs do:
 *  - WHICH PROGRAM failed. `err` gives an instruction index into a list the
 *    caller usually does not have. The logs carry "Program <id> failed:".
 *  - The error's NAME. Anchor prints "Error Code: X. Error Number: N. Error
 *    Message: M." for 18% of failures, which is the Solana equivalent of the
 *    Aptos name fallback: when it is there it is authoritative, and when it is
 *    not we must not invent one.
 */

export type SolanaErrorCause =
  | "program_error"       // a program rejected it with its own code
  | "compute_exceeded"    // ran out of compute budget
  | "program_crashed"     // ProgramFailedToComplete: panicked or aborted
  | "insufficient_funds"  // could not pay
  | "unknown"

export interface DecodedSolanaError {
  cause: SolanaErrorCause
  /** The program that actually failed, read from the logs. */
  program: string | null
  /** Which instruction in the transaction. */
  instructionIndex: number | null
  /** The program's own error number, e.g. 6001. */
  code: number | null
  /** Anchor's own name for it, when Anchor printed one. Never invented. */
  errorName: string | null
  /** Plain English. Always set. Says what is not known rather than guessing. */
  reason: string
  /** True when we could not identify the error and said so. */
  unrecognised: boolean
  raw: string
}

/**
 * Anchor reserves fixed RANGES, and the range alone is a real finding even when
 * the specific code is not in any map: it says which KIND of thing went wrong.
 * Ranges are far more stable than individual codes, so this stays correct as
 * Anchor evolves. 6000+ is where a program's own errors start, which is why
 * 0x1770 and 0x1771 are the two codes everyone recognises on sight.
 */
function anchorRange(code: number): string | null {
  if (code >= 100 && code < 1000) return "an instruction was malformed or missing accounts"
  if (code >= 1000 && code < 2000) return "the program's interface definition did not match the call"
  if (code >= 2000 && code < 3000) return "a constraint on one of the accounts was not satisfied"
  if (code >= 3000 && code < 4000) return "an account was missing, uninitialised, or owned by the wrong program"
  if (code >= 4100 && code < 5000) return "a deprecated Anchor check failed"
  return null
}

/**
 * Well-known programs. Deliberately small: these are the ones observed failing
 * in real traffic, where the meaning is documented and stable. Anything else
 * degrades honestly rather than being guessed at.
 */
const KNOWN_PROGRAMS: Record<string, string> = {
  "11111111111111111111111111111111": "the System program",
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: "the SPL Token program",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "the Associated Token Account program",
  ComputeBudget111111111111111111111111111111: "the Compute Budget program",
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter",
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "the pump.fun AMM",
}

/** The program that failed, from its own log line. */
function failingProgram(logs: readonly string[]): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = /^Program (\S+) failed:/.exec(logs[i] ?? "")
    if (m?.[1]) return m[1]
  }
  return null
}

/**
 * Anchor's structured error log. When present this is the program's own name
 * and message for the failure, which beats anything we could map, so it wins.
 *   "AnchorError thrown in programs/pump-amm/src/…/sell.rs:170.
 *    Error Code: ExceededSlippage. Error Number: 6004. Error Message: ExceededSlippage."
 */
function anchorError(logs: readonly string[]): { name: string; number: number; message: string } | null {
  for (const l of logs) {
    const name = /Error Code: ([A-Za-z0-9_]+)\./.exec(l)
    const num = /Error Number: (\d+)\./.exec(l)
    if (!name?.[1] || !num?.[1]) continue
    const msg = /Error Message: (.+?)\.?$/.exec(l)
    return { name: name[1], number: Number(num[1]), message: (msg?.[1] ?? name[1]).trim() }
  }
  return null
}

const label = (p: string | null) => (p ? (KNOWN_PROGRAMS[p] ?? `the program at ${p}`) : "a program")

/** Anchor's own message is often just the CamelCase name again; space it out. */
function humanise(message: string, name: string): string {
  if (message !== name) return message
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()
}

/**
 * Two sources for the failing program, because we read Solana two ways.
 * The RAW RPC path has `logs`, which name it directly. The Helius ENRICHED
 * path has no logs but does have the instruction list, and the error's own
 * instruction index points straight into it. Either is better than the `err`
 * object alone, which names an index into a list the caller may not hold.
 */
export interface SolanaErrorContext {
  logs?: readonly string[]
  /** Program ids by instruction index, as Helius returns them. */
  programIds?: readonly string[]
}

export function decodeSolanaError(err: unknown, ctx: SolanaErrorContext | readonly string[] = {}): DecodedSolanaError {
  const c: SolanaErrorContext = Array.isArray(ctx) ? { logs: ctx } : (ctx as SolanaErrorContext)
  const logs = c.logs ?? []
  const raw = typeof err === "string" ? err : JSON.stringify(err ?? null)
  const idxForProgram = (err as { InstructionError?: [number, unknown] } | null)?.InstructionError?.[0]
  const program =
    failingProgram(logs) ??
    (typeof idxForProgram === "number" ? (c.programIds?.[idxForProgram] ?? null) : null)
  const who = label(program)
  const base = { program, raw, errorName: null as string | null }

  const ie = (err as { InstructionError?: [number, unknown] } | null)?.InstructionError
  if (!Array.isArray(ie)) {
    return { ...base, cause: "unknown", instructionIndex: null, code: null, unrecognised: true,
      reason: `The transaction failed with a status this decoder does not recognise: ${raw.slice(0, 120)}.` }
  }

  const idx = typeof ie[0] === "number" ? ie[0] : null
  const kind = ie[1]

  if (kind === "ComputationalBudgetExceeded") {
    return { ...base, cause: "compute_exceeded", instructionIndex: idx, code: null, unrecognised: false,
      reason: "The transaction ran out of compute budget before it finished. Nothing was completed and only the fee was spent. Raise the compute unit limit and send it again." }
  }
  if (kind === "ProgramFailedToComplete") {
    return { ...base, cause: "program_crashed", instructionIndex: idx, code: null, unrecognised: false,
      reason: `${who} stopped partway through rather than rejecting the request cleanly, usually a compute limit or an internal error. Nothing it was doing took effect.` }
  }
  if (typeof kind === "string") {
    return { ...base, cause: "program_error", instructionIndex: idx, code: null, unrecognised: true,
      reason: `${who} rejected the transaction with "${kind}", which this decoder does not have a description for.` }
  }

  const custom = (kind as { Custom?: number } | null)?.Custom
  if (typeof custom !== "number") {
    return { ...base, cause: "unknown", instructionIndex: idx, code: null, unrecognised: true,
      reason: `The transaction failed with a status this decoder does not recognise: ${raw.slice(0, 120)}.` }
  }

  // Anchor said it itself. Prefer that over anything we could infer.
  const anchor = anchorError(logs)
  if (anchor && anchor.number === custom) {
    return { ...base, cause: "program_error", instructionIndex: idx, code: custom, errorName: anchor.name, unrecognised: false,
      reason: `${who} rejected the transaction: ${humanise(anchor.message, anchor.name)}. Nothing was completed and only the fee was spent.` }
  }

  // HARVESTED MAP. The Anchor log is only present on ~11% of failures, so the
  // same program hitting the same code silently gets nothing. Every entry here
  // was observed being printed by that program, so this carries the answer
  // across to the times it stays quiet.
  const mapped = program ? PROGRAM_ERRMAPS[program]?.[custom] : undefined
  if (mapped) {
    return { ...base, cause: "program_error", instructionIndex: idx, code: custom, errorName: mapped.name, unrecognised: false,
      reason: `${who} rejected the transaction: ${mapped.reason}` }
  }

  // The System program's Custom(1) is the one code common enough, and
  // documented enough, to name: the account could not cover the transfer.
  if (program === "11111111111111111111111111111111" && custom === 1) {
    return { ...base, cause: "insufficient_funds", instructionIndex: idx, code: 1, unrecognised: false,
      reason: "The account did not have enough SOL to cover the transfer plus the fee and rent. Nothing moved. Top it up and try again." }
  }

  const range = anchorRange(custom)
  if (range) {
    return { ...base, cause: "program_error", instructionIndex: idx, code: custom, unrecognised: false,
      reason: `${who} rejected the transaction because ${range} (error ${custom}). Nothing was completed and only the fee was spent.` }
  }

  // 6000 and up is a program's OWN error space. We know the number is
  // meaningful to that program and nothing more, so we say exactly that rather
  // than inventing a meaning. This is the honest floor, not a failure.
  const own = custom >= 6000 ? " This is one of its own error codes, so the meaning is defined by the program rather than by Solana." : ""
  return { ...base, cause: "program_error", instructionIndex: idx, code: custom, unrecognised: true,
    reason: `${who} rejected the transaction with error ${custom} (0x${custom.toString(16)}), and does not publish a description for it.${own} Nothing was completed and only the fee was spent.` }
}
