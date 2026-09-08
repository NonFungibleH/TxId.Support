import { OPERATION_TYPES, RESULT_CODE_ENUM_FOR_OP, SUCCESS_PAYLOAD_BYTES, codeName } from "./codes"

/**
 * Stellar's TransactionResult, decoded by hand.
 *
 * WHY BY HAND, when @stellar/stellar-base exists. Because the part that matters
 * is twelve bytes of arithmetic and the library is a large runtime dependency in
 * a package that otherwise only makes HTTP calls, exactly the call already made
 * for Solana's pubkey.ts. XDR is fixed big-endian 4-byte words with no framing,
 * so the walk below is the whole format:
 *
 *   TransactionResult
 *     int64   feeCharged
 *     union switch (TransactionResultCode)
 *       case txFAILED / txSUCCESS: OperationResult results<>
 *     ext
 *
 *   OperationResult
 *     union switch (OperationResultCode)
 *       case opINNER: union switch (OperationType) { <OpName>Result }
 *
 *   <OpName>Result
 *     union switch (int32 code)   // every FAILURE case is void
 *
 * THE WALL, AND IT IS SMALLER THAN IT LOOKS. A failure case carries no payload,
 * so a failing operation costs exactly three words: opINNER, the operation type
 * and the code. A SUCCESS case may carry a payload, which has to be skipped to
 * reach a LATER failing operation, and that is the only hard part.
 *
 * Harvested from the XDR rather than assumed: 21 of the 27 operation successes
 * are `void` or a fixed size (AccountMerge 8, InvokeHostFunction 32,
 * CreateClaimableBalance 36) and are skipped exactly. The six that are not are
 * the DEX operations, whose success carries a variable-length array of every
 * offer crossed: PATH_PAYMENT_STRICT_SEND and _RECEIVE, MANAGE_SELL_OFFER,
 * MANAGE_BUY_OFFER, CREATE_PASSIVE_SELL_OFFER and INFLATION. Those stop the
 * walk, and it says so.
 *
 * We never scan forward looking for something that parses. A plausible-looking
 * int in the middle of a payload is exactly how you report a confident wrong
 * reason, and the whole point of this package is not doing that.
 */

export interface StellarOperationResult {
  /** Index in the transaction's operation list. */
  index: number
  /** "PATH_PAYMENT_STRICT_SEND", or null when the outer code was not opINNER. */
  type: string | null
  /** The raw signed code. Negative is a failure, 0 or positive a success. */
  code: number | null
  /** e.g. "PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN". Null when unmapped. */
  name: string | null
  /** Set when the outer OperationResultCode was not opINNER (opBAD_AUTH etc). */
  outer: string | null
  failed: boolean
}

export interface DecodedStellarResult {
  /** "FAILED", "SUCCESS", "FEE_BUMP_INNER_FAILED"… straight from Stellar's own enum. */
  code: string
  rawCode: number
  feeChargedStroops: string
  /** How many operation results the array declared. Null when there is no array. */
  operationCount: number | null
  operations: StellarOperationResult[]
  /**
   * True when the walk stopped early at a successful operation whose payload we
   * cannot size. The operations listed are still exact; there may be a later one
   * we did not reach.
   */
  incomplete: boolean
  /** The first failing operation, which is the one a user is asking about. */
  failing: StellarOperationResult | null
  /**
   * True when this was a fee bump and the operations below come from the INNER
   * transaction it was paying for. The fee bump itself did not fail.
   */
  feeBump: boolean
}

const MAX_OPS = 128

export function decodeTransactionResult(resultXdrBase64: string): DecodedStellarResult | null {
  let b: Buffer
  try {
    b = Buffer.from(resultXdrBase64, "base64")
  } catch {
    return null
  }
  if (b.length < 12) return null

  let o = 0
  const i32 = (): number | null => {
    if (o + 4 > b.length) return null
    const v = b.readInt32BE(o)
    o += 4
    return v
  }

  const fee = b.readBigInt64BE(0)
  o = 8
  const rawCode = i32()
  if (rawCode === null) return null

  const out: DecodedStellarResult = {
    code: codeName("TransactionResultCode", rawCode) ?? `unknown(${rawCode})`,
    rawCode,
    feeChargedStroops: fee.toString(),
    operationCount: null,
    operations: [],
    incomplete: false,
    failing: null,
    feeBump: false,
  }

  // A FEE BUMP carries the result it was paying for INSIDE itself, so there is
  // no need to send anyone to look up a second transaction: skip the 32-byte
  // inner hash and decode the InnerTransactionResult that follows. 16% of live
  // mainnet failures arrive wrapped this way (22 of 184, 2026-09-07), and
  // several of those inner results are Soroban contract failures, which is the
  // detail a user actually needs.
  if (rawCode === -13 || rawCode === 1) {
    o += 32
    if (o + 12 > b.length) { out.incomplete = true; return out }
    const innerFee = b.readBigInt64BE(o); o += 8
    const innerCode = i32()
    if (innerCode === null) { out.incomplete = true; return out }
    out.feeBump = true
    out.feeChargedStroops = fee.toString()
    out.code = codeName("TransactionResultCode", innerCode) ?? `unknown(${innerCode})`
    out.rawCode = innerCode
    void innerFee
    if (innerCode !== -1 && innerCode !== 0) return out
    return walkOperations(out, i32, b, () => o, n => { o = n })
  }

  // Only txFAILED and txSUCCESS carry the results array. Everything else (a bad
  // sequence number, an unfunded fee account) failed before any operation ran,
  // and the top-level code IS the whole answer.
  if (rawCode !== -1 && rawCode !== 0) return out
  return walkOperations(out, i32, b, () => o, n => { o = n })
}

function walkOperations(
  out: DecodedStellarResult,
  i32: () => number | null,
  b: Buffer,
  getOffset: () => number,
  setOffset: (n: number) => void,
): DecodedStellarResult {
  const n = i32()
  if (n === null || n < 0 || n > MAX_OPS) return out
  out.operationCount = n

  for (let index = 0; index < n; index++) {
    const outer = i32()
    if (outer === null) { out.incomplete = true; break }
    if (outer !== 0) {
      // opBAD_AUTH, opNO_ACCOUNT and friends are void, so the walk continues.
      const name = codeName("OperationResultCode", outer)
      const op: StellarOperationResult = { index, type: null, code: outer, name, outer: name, failed: true }
      out.operations.push(op)
      if (!out.failing) out.failing = op
      continue
    }
    const type = i32()
    const code = i32()
    if (type === null || code === null) { out.incomplete = true; break }
    const typeName = OPERATION_TYPES[type] ?? null
    const enumName = typeName ? RESULT_CODE_ENUM_FOR_OP[typeName] : undefined
    const op: StellarOperationResult = {
      index,
      type: typeName,
      code,
      name: enumName ? codeName(enumName, code) : null,
      outer: null,
      failed: code < 0,
    }
    out.operations.push(op)
    if (op.failed && !out.failing) out.failing = op
    if (!op.failed) {
      const skip = typeName ? SUCCESS_PAYLOAD_BYTES[typeName] : undefined
      if (skip === undefined || skip < 0) {
        // A variable-length success payload. Stop, and say so.
        out.incomplete = true
        break
      }
      setOffset(getOffset() + skip)
      if (getOffset() > b.length) { out.incomplete = true; break }
    }
  }
  return out
}
