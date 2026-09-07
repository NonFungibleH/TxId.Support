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
 *     hand-written from the protocol's own documentation.
 *  3. NO std::error CATEGORY. Aptos packs a category into the high bits, so an
 *     unmapped code still yields "invalid state". Sui codes are raw constants
 *     and carry no such structure, so an unmapped Sui code tells us strictly
 *     less than an unmapped Aptos one.
 *
 * The consequence is deliberate and should not be "improved" away: an unmapped
 * Sui abort resolves to the module, the function and the number, and says the
 * package publishes no description. That is the whole truth available.
 *
 * Real mainnet status, captured 2026-09-07:
 *   MoveAbort(MoveLocation { module: ModuleId { address: c72126…, name:
 *   Identifier("h86261") }, function: 1, instruction: 32, function_name:
 *   Some("h8b64d") }, 200) in command 0
 */

export interface DecodedSuiAbort {
  cause: "move_abort" | "unknown"
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
  /** Plain English. Always set. States what is not known rather than guessing. */
  reason: string
  raw: string
}

export type SuiErrmap = Record<string, Record<number, { name: string; reason: string }>>

/** 0x0…0abc and 0xabc are the same package; store and compare one spelling. */
export function normalizeSuiAddress(address: string): string {
  const hex = address.trim().toLowerCase().replace(/^0x/, "")
  if (!/^[0-9a-f]{1,64}$/.test(hex)) return address.trim().toLowerCase()
  return "0x" + hex.padStart(64, "0")
}

const ABORT_RE =
  /MoveAbort\(MoveLocation\s*\{\s*module:\s*ModuleId\s*\{\s*address:\s*([0-9a-fA-F]+)\s*,\s*name:\s*Identifier\("([^"]+)"\)\s*\}\s*,\s*function:\s*(\d+)(?:\s*,\s*instruction:\s*(\d+))?(?:\s*,\s*function_name:\s*(?:Some\("([^"]+)"\)|None))?\s*\}\s*,\s*(\d+)\s*\)(?:\s*in\s+command\s+(\d+))?/

const where = (mod: string | null, fn: string | null) =>
  fn && mod ? `${mod}::${fn}` : (mod ?? "the package")

export function decodeSuiAbort(status: string, errmap?: SuiErrmap): DecodedSuiAbort {
  const raw = typeof status === "string" ? status : String(status ?? "")
  const m = ABORT_RE.exec(raw)

  if (!m) {
    return {
      cause: "unknown", package: null, module: null, functionName: null, functionIndex: null,
      code: null, command: null, errorName: null, raw,
      reason: raw
        ? `The transaction failed with a status this decoder does not recognise: "${raw.slice(0, 140)}".`
        : "The transaction failed and the network gave no status to interpret.",
    }
  }

  const pkg = normalizeSuiAddress(m[1] ?? "")
  const module = m[2] ?? null
  const functionIndex = m[3] !== undefined ? Number(m[3]) : null
  const functionName = m[5] ?? null
  const code = Number(m[6])
  const command = m[7] !== undefined ? Number(m[7]) : null
  const base = { cause: "move_abort" as const, package: pkg, module, functionName, functionIndex, code, command, raw }

  const mapped = module ? errmap?.[`${pkg}::${module}`]?.[code] : undefined
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
