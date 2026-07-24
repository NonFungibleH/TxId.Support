import type { DecodedAbort } from "./types"
import { normalizeAptosAddress } from "./index"

const CATEGORY_NAMES: Record<number, string> = {
  1: "invalid argument",
  2: "out of range",
  3: "invalid state",
  4: "unauthenticated",
  5: "permission denied",
  6: "not found",
  7: "aborted",
  8: "already exists",
  9: "resource exhausted",
  0xa: "cancelled",
  0xb: "internal error",
  0xc: "not implemented",
  0xd: "unavailable",
}

const FRAMEWORK_ERRORS: Record<string, Record<number, { name: string; reason: string }>> = {
  "0x1::coin": {
    0x10001: { name: "ECOIN_INFO_ADDRESS_MISMATCH", reason: "The coin type's address does not match the account that published it." },
    0x80002: { name: "ECOIN_INFO_ALREADY_PUBLISHED", reason: "This coin type has already been initialized and cannot be created again." },
    0x60003: { name: "ECOIN_INFO_NOT_PUBLISHED", reason: "This coin type has not been initialized on chain, so it cannot be used." },
    0x80004: { name: "ECOIN_STORE_ALREADY_PUBLISHED", reason: "The wallet has already registered this coin type; no need to register again." },
    0x60005: { name: "ECOIN_STORE_NOT_PUBLISHED", reason: "The wallet has not registered this coin type. The recipient (or sender) needs to register the coin before it can be held or transferred." },
    0x10006: { name: "EINSUFFICIENT_BALANCE", reason: "The wallet has insufficient balance to complete the transfer or operation. Check the amount plus gas costs against the available balance." },
    0x5000a: { name: "EFROZEN", reason: "The coin store for this wallet is frozen, so deposits and withdrawals of this coin are blocked." },
  },
  "0x1::account": {
    0x80001: { name: "EACCOUNT_ALREADY_EXISTS", reason: "An account already exists at this address, so it cannot be created again." },
    0x60002: { name: "EACCOUNT_DOES_NOT_EXIST", reason: "No account exists at this address. It may need to be created or funded first." },
    0x20003: { name: "ESEQUENCE_NUMBER_TOO_BIG", reason: "The account's sequence number is too large. This usually means too many transactions were submitted at once; wait for pending transactions to settle and retry." },
    0x10004: { name: "EMALFORMED_AUTHENTICATION_KEY", reason: "The provided authentication key is malformed. It must be exactly 32 bytes." },
  },
  "0x1::aptos_account": {
    0x60001: { name: "EACCOUNT_NOT_FOUND", reason: "The target account does not exist on chain. Sending APT to it first will create it." },
    0x50003: { name: "EACCOUNT_DOES_NOT_ACCEPT_DIRECT_COIN_TRANSFERS", reason: "The recipient has opted out of receiving coins they have not registered for, so this direct transfer was blocked." },
  },
  "0x1::fungible_asset": {
    0x10003: { name: "ESTORE_IS_FROZEN", reason: "The fungible asset store is frozen, so deposits and withdrawals are blocked for this asset." },
    0x10004: { name: "EINSUFFICIENT_BALANCE", reason: "The wallet has insufficient balance of this fungible asset to complete the withdrawal or transfer." },
  },
  "0x1::object": {
    0x80001: { name: "EOBJECT_EXISTS", reason: "An object already exists at this address, so it cannot be created again." },
    0x60002: { name: "EOBJECT_DOES_NOT_EXIST", reason: "The referenced object does not exist on chain. It may have been deleted or the address may be wrong." },
    0x50003: { name: "ENO_UNGATED_TRANSFERS", reason: "This object does not allow direct transfers; only the creator-defined transfer flow can move it." },
    0x50004: { name: "ENOT_OBJECT_OWNER", reason: "The signing wallet is not the owner of this object, so it cannot perform this operation." },
  },
  "0x1::timestamp": {
    0x30001: { name: "ENOT_OPERATING", reason: "The on-chain clock is not in an operating state; this operation is not available right now." },
    0x10002: { name: "EINVALID_TIMESTAMP", reason: "The provided timestamp is invalid; it must be ahead of the current on-chain time." },
  },
  "0x3::token": {
    0x60002: { name: "ECOLLECTIONS_NOT_PUBLISHED", reason: "The creator account has no token collections published, so the requested collection cannot be found." },
    0x60003: { name: "ECOLLECTION_NOT_PUBLISHED", reason: "The requested collection does not exist under the creator account. Check the collection name and creator address." },
    0x10006: { name: "EINSUFFICIENT_BALANCE", reason: "The wallet does not hold enough of this token to complete the transfer or burn." },
  },
  "0x4::token": {
    0x60001: { name: "ETOKEN_DOES_NOT_EXIST", reason: "The referenced token does not exist. It may have been burned or the address may be wrong." },
    0x50002: { name: "ENOT_CREATOR", reason: "The signing wallet is not the creator of this token, so it cannot perform this creator-only operation." },
  },
}

export type AbortErrmap = Record<string, Record<number, { name: string; reason: string }>>

function normalizeModuleKey(mod: string): string {
  const sep = mod.indexOf("::")
  if (sep === -1) return mod
  return normalizeAptosAddress(mod.slice(0, sep)) + "::" + mod.slice(sep + 2)
}

const NORMALIZED_FRAMEWORK: Record<string, Record<number, { name: string; reason: string }>> = Object.fromEntries(
  Object.entries(FRAMEWORK_ERRORS).map(([k, v]) => [normalizeModuleKey(k), v])
)

const MOVE_ABORT_RE = /^Move abort in (0x[0-9a-fA-F]+::[A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/
const NAMED_CODE_RE = /^([A-Za-z_][A-Za-z0-9_]*)\((0x[0-9a-fA-F]+|\d+)\)$/

export function decodeAbort(vmStatus: string, errmap?: AbortErrmap): DecodedAbort {
  const raw = vmStatus

  if (/out[ _]?of[ _]?gas/i.test(vmStatus)) {
    return {
      cause: "out_of_gas",
      module: null,
      code: null,
      category: null,
      errorName: null,
      reason: "The transaction ran out of gas before it could finish. Retry with a higher max gas amount.",
      raw,
    }
  }

  const abortMatch = vmStatus.match(MOVE_ABORT_RE)
  if (abortMatch) {
    const module = abortMatch[1] ?? ""
    const codePart = (abortMatch[2] ?? "").trim()

    let parsedName: string | null = null
    let codeStr = codePart
    const named = codePart.match(NAMED_CODE_RE)
    if (named) {
      parsedName = named[1] ?? null
      codeStr = named[2] ?? ""
    }

    let big: bigint | null = null
    try {
      big = BigInt(codeStr)
    } catch {
      big = null
    }

    if (big === null) {
      return {
        cause: "move_abort",
        module,
        code: null,
        category: null,
        errorName: parsedName,
        reason: `The transaction was rejected by ${module} with an abort code that could not be parsed (${codePart}).`,
        raw,
      }
    }

    if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
      return {
        cause: "move_abort",
        module,
        code: null,
        category: null,
        errorName: parsedName,
        reason: `The transaction was rejected by ${module} with error code ${big.toString()}. The module doesn't publish a description for this code.`,
        raw,
      }
    }

    const code = Number(big)
    // BigInt shift, not >>: JS number >> truncates at 32 bits and would invent a false category for large u64 codes
    const category = big > 0xffffn && big >> 16n <= 0xdn ? CATEGORY_NAMES[Number(big >> 16n)] ?? null : null

    const modKey = normalizeModuleKey(module)
    let mapped: { name: string; reason: string } | null = null
    if (errmap) {
      for (const [k, codes] of Object.entries(errmap)) {
        if (normalizeModuleKey(k) === modKey) {
          mapped = codes[code] ?? null
          break
        }
      }
    }
    const frameworkHit = NORMALIZED_FRAMEWORK[modKey]?.[code] ?? null

    const errorName = mapped?.name ?? frameworkHit?.name ?? parsedName
    let reason: string
    if (mapped) {
      reason = mapped.reason
    } else if (frameworkHit) {
      reason = frameworkHit.reason
    } else if (category) {
      reason = `The transaction was rejected by ${module} with error code ${code} (category: ${category}). The module doesn't publish a description for this specific code.`
    } else {
      reason = `The transaction was rejected by ${module} with error code ${code}. The module doesn't publish a description for this code.`
    }

    return { cause: "move_abort", module, code, category, errorName, reason, raw }
  }

  if (/^execution fail/i.test(vmStatus)) {
    const execModule = vmStatus.match(/in (0x[0-9a-fA-F]+::[A-Za-z_][A-Za-z0-9_]*)/)
    const module = execModule?.[1] ?? null
    return {
      cause: "execution_failure",
      module,
      code: null,
      category: null,
      errorName: null,
      reason: module
        ? `The transaction hit a low-level execution failure inside ${module}. This is usually a bug or an unexpected on-chain state rather than a user error.`
        : "The transaction hit a low-level execution failure. This is usually a bug or an unexpected on-chain state rather than a user error.",
      raw,
    }
  }

  return {
    cause: "unknown",
    module: null,
    code: null,
    category: null,
    errorName: null,
    reason: `The transaction failed with a status this decoder doesn't recognize: "${raw}".`,
    raw,
  }
}
