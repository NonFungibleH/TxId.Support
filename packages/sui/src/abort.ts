/**
 * What a failed Sui transaction says, and what we can honestly make of it.
 *
 * Sui is Move, so the shape rhymes with Aptos, but three differences matter and
 * all three make Sui HARDER:
 *
 *  1. THE ABORT CARRIES NO NAME. Aptos fullnodes embed the error constant in
 *     vm_status ("EPRICE_CROSSING(0x1)"), which gives us a name fallback for
 *     free. Sui gives a bare integer. Verified against live mainnet.
 *  2. CONSTANTS ARE NOT ON CHAIN. sui_getNormalizedMoveModule returns structs
 *     and exposedFunctions and no constants field, so unlike Aptos (whose
 *     PackageRegistry stores source we harvest from) every Sui error map is
 *     built from the protocol's published source. See errmap.ts.
 *  3. NO std::error CATEGORY. Aptos packs a category into the high bits, so an
 *     unmapped code still yields "invalid state". Sui codes are raw constants
 *     and carry no such structure, so an unmapped Sui code tells us strictly
 *     less than an unmapped Aptos one.
 *
 * The consequence is deliberate and should not be "improved" away: an unmapped
 * Sui abort resolves to the module, the function and the number, and says the
 * package publishes no description. That is the whole truth available.
 *
 * NOT EVERY FAILURE IS AN ABORT, and for a long time we treated them as if they
 * were. Census of 4,122 mainnet transactions across 150 checkpoints, 2026-09-07:
 * 420 failed (10.19%, close to Solana's rate and roughly twenty times Aptos's),
 * of which 344 were Move aborts and 76 were not. Those 76, an entire 18% of
 * Sui's failures, fell to "a status this decoder does not recognise". They are
 * InsufficientCoinBalance (70) and InsufficientGas (6), both of them structural
 * Sui statuses that need no protocol knowledge at all to explain.
 *
 * Real mainnet payloads, captured 2026-09-07:
 *   MoveAbort(MoveLocation { module: ModuleId { address: c72126…, name:
 *   Identifier("h86261") }, function: 1, instruction: 32, function_name:
 *   Some("h8b64d") }, 200) in command 0
 *   InsufficientCoinBalance in command 3
 *   InsufficientGas
 *
 * Statuses are only those observed live. The stack emits others (argument
 * errors, unused values, object-not-found); we have not held a real payload for
 * them, so they take the honest floor rather than wording invented from the
 * type definition. Do not add a branch without a captured example.
 */

export interface DecodedSuiAbort {
  cause: "move_abort" | "insufficient_coin" | "insufficient_gas" | "unknown"
  /** Package address, 0x-prefixed and lower case. Null when unparsed. */
  package: string | null
  module: string | null
  /** The function's own name when the node gave one, else null. Never invented. */
  functionName: string | null
  functionIndex: number | null
  code: number | null
  /** Which programmable-transaction command failed. Sui-specific and useful. */
  command: number | null
  /** The protocol's own name for this code, only ever from an error map. */
  errorName: string | null
  /** The failing command's kind, when the transaction's own command list was read. */
  commandKind: string | null
  /** For a MoveCall command, what it was calling. Null when not a MoveCall or not read. */
  commandTarget: string | null
  /** Where the coin came from, when the failing command names exactly one source. */
  coinOrigin: "sender" | "gas_coin" | "earlier_command" | null
  /** Plain English. Always set. States what is not known rather than guessing. */
  reason: string
  raw: string
}

export type SuiErrmap = Record<string, Record<number, { name: string; reason: string }>>

/**
 * The transaction's own command list, from `showInput`. Optional everywhere:
 * absent means NOT READ, and every sentence that depends on it is omitted
 * rather than guessed.
 */
export interface SuiAbortContext {
  commands?: unknown[] | undefined
  /**
   * The package's ORIGINAL id, resolved by package.ts. Sui upgrades republish
   * at a new address, so the runtime address in the abort is not a stable key.
   */
  originalPackage?: string | undefined
}

/** 0x0…0abc and 0xabc are the same package; store and compare one spelling. */
export function normalizeSuiAddress(address: string): string {
  const hex = address.trim().toLowerCase().replace(/^0x/, "")
  if (!/^[0-9a-f]{1,64}$/.test(hex)) return address.trim().toLowerCase()
  return "0x" + hex.padStart(64, "0")
}

const ABORT_RE =
  /MoveAbort\(MoveLocation\s*\{\s*module:\s*ModuleId\s*\{\s*address:\s*([0-9a-fA-F]+)\s*,\s*name:\s*Identifier\("([^"]+)"\)\s*\}\s*,\s*function:\s*(\d+)(?:\s*,\s*instruction:\s*(\d+))?(?:\s*,\s*function_name:\s*(?:Some\("([^"]+)"\)|None))?\s*\}\s*,\s*(\d+)\s*\)(?:\s*in\s+command\s+(\d+))?/

/** Every Sui execution status can carry this suffix, not only the ones we decode. */
const COMMAND_RE = /\bin\s+command\s+(\d+)/

const where = (mod: string | null, fn: string | null) =>
  fn && mod ? `${mod}::${fn}` : (mod ?? "the package")

const EMPTY = {
  package: null, module: null, functionName: null, functionIndex: null, code: null,
  command: null, errorName: null, commandKind: null, commandTarget: null, coinOrigin: null,
} as const

/**
 * An argument in a programmable transaction is one of "GasCoin", {Input: n},
 * {Result: n} or {NestedResult: [n, m]}. Which of those it is answers a question
 * that matters a great deal to a confused user: did the shortfall come out of
 * their wallet, or out of what an earlier step in the same transaction returned?
 */
function originOf(arg: unknown): DecodedSuiAbort["coinOrigin"] {
  if (arg === "GasCoin") return "gas_coin"
  if (!arg || typeof arg !== "object") return null
  const o = arg as Record<string, unknown>
  if ("Input" in o) return "sender"
  if ("Result" in o || "NestedResult" in o) return "earlier_command"
  return null
}

interface CommandFacts {
  kind: string | null
  target: string | null
  coinOrigin: DecodedSuiAbort["coinOrigin"]
}

function readCommand(commands: unknown[] | undefined, index: number | null): CommandFacts {
  const none: CommandFacts = { kind: null, target: null, coinOrigin: null }
  if (!Array.isArray(commands) || index === null) return none
  const cmd = commands[index]
  if (!cmd || typeof cmd !== "object") return none
  const kind = Object.keys(cmd as Record<string, unknown>)[0]
  if (!kind) return none
  const body = (cmd as Record<string, unknown>)[kind]

  if (kind === "MoveCall" && body && typeof body === "object") {
    const c = body as Record<string, unknown>
    const parts = [c["package"], c["module"], c["function"]].filter(p => typeof p === "string")
    return { kind, target: parts.length === 3 ? parts.join("::") : null, coinOrigin: null }
  }
  // SplitCoins is [source, [amounts]] and MergeCoins is [destination, [sources]].
  // Both name exactly ONE coin the value is taken from, which is the only shape
  // that lets us say where it came from without guessing.
  if ((kind === "SplitCoins" || kind === "MergeCoins") && Array.isArray(body)) {
    return { kind, target: null, coinOrigin: originOf(body[0]) }
  }
  return { kind, target: null, coinOrigin: null }
}

const NOTHING_HAPPENED =
  "A Sui transaction is a single list of commands that all take effect or none do, so nothing it set out to do was completed and only the gas was spent."

function coinShortfall(facts: CommandFacts, command: number | null, total: number | null): string {
  const step =
    command === null
      ? "one of its commands"
      : total !== null
        ? `command ${command} of ${total}`
        : `command ${command}`

  let detail = ""
  if (facts.kind === "SplitCoins" || facts.kind === "MergeCoins") {
    if (facts.coinOrigin === "earlier_command") {
      detail =
        " That step took the amount from a coin an earlier command in the same transaction had produced, not from a coin in your wallet. So what fell short is what the earlier step returned, which is what happens when a route is built expecting more back than it actually got."
    } else if (facts.coinOrigin === "sender" || facts.coinOrigin === "gas_coin") {
      detail =
        " That step took the amount from a coin supplied out of your own wallet, so the shortfall was in your balance of that coin at the moment the transaction ran."
    }
  } else if (facts.kind === "MoveCall" && facts.target) {
    detail = ` That step was a call to ${facts.target}, and the coin handed to it held less than it required.`
  }

  return (
    `The transaction was stopped at ${step} because a coin it tried to take an amount from held less than the amount asked for.${detail} ` +
    `Sui does not say in the status which coin that was, so this is not necessarily your SUI balance. ${NOTHING_HAPPENED}`
  )
}

export function decodeSuiAbort(status: string, errmap?: SuiErrmap, context?: SuiAbortContext): DecodedSuiAbort {
  const raw = typeof status === "string" ? status : String(status ?? "")
  const commands = context?.commands
  const total = Array.isArray(commands) ? commands.length : null

  const m = ABORT_RE.exec(raw)
  if (m) {
    const pkg = normalizeSuiAddress(m[1] ?? "")
    const module = m[2] ?? null
    const functionIndex = m[3] !== undefined ? Number(m[3]) : null
    const functionName = m[5] ?? null
    const code = Number(m[6])
    const command = m[7] !== undefined ? Number(m[7]) : null
    const facts = readCommand(commands, command)
    const base = {
      cause: "move_abort" as const, package: pkg, module, functionName, functionIndex, code, command,
      commandKind: facts.kind, commandTarget: facts.target, coinOrigin: null, raw,
    }

    // An upgrade republishes at a new address, so the runtime one in the abort
    // is not a stable key. Try the resolved original first, then the runtime
    // address, which still works for a package that has never been upgraded and
    // for any map written against what was actually seen.
    const keys = [context?.originalPackage, pkg].filter((k): k is string => typeof k === "string" && k.length > 0)
    let mapped: { name: string; reason: string } | undefined
    if (module) {
      for (const k of keys) {
        mapped = errmap?.[`${normalizeSuiAddress(k)}::${module}`]?.[code]
        if (mapped) break
      }
    }
    if (mapped) return { ...base, errorName: mapped.name, reason: mapped.reason }

    // No name in the abort, no constants on chain, no category in the code. This
    // is the whole truth available, and stating it plainly is the answer.
    const cmd = command !== null ? ` (command ${command})` : ""
    return {
      ...base,
      errorName: null,
      reason: `The transaction was rejected by ${where(module, functionName)} with error code ${code}${cmd}. The package publishes no description for this code, so what it means is defined by the protocol rather than by Sui. Nothing was completed and only the gas was spent.`,
    }
  }

  const command = raw.match(COMMAND_RE) ? Number(COMMAND_RE.exec(raw)![1]) : null

  if (/^InsufficientCoinBalance\b/.test(raw)) {
    const facts = readCommand(commands, command)
    return {
      ...EMPTY, cause: "insufficient_coin", command, raw,
      commandKind: facts.kind, commandTarget: facts.target, coinOrigin: facts.coinOrigin,
      reason: coinShortfall(facts, command, total),
    }
  }

  if (/^InsufficientGas\b/.test(raw)) {
    return {
      ...EMPTY, cause: "insufficient_gas", command, raw,
      reason:
        "The transaction needed more gas than the budget set on it, so the network stopped it partway. " +
        "This is the budget the transaction was signed with rather than how much SUI is in the wallet, and most wallets let it be raised before signing. " +
        NOTHING_HAPPENED,
    }
  }

  if (!raw) {
    return { ...EMPTY, cause: "unknown", command: null, raw, reason: "The transaction failed and the network gave no status to interpret." }
  }

  const at = command !== null ? ` at command ${command}${total !== null ? ` of ${total}` : ""}` : ""
  return {
    ...EMPTY, cause: "unknown", command, raw,
    reason: `The transaction failed${at} with a status this decoder does not recognise: "${raw.slice(0, 140)}". ${NOTHING_HAPPENED}`,
  }
}
