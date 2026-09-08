/**
 * Harvest every Stellar result-code enum from Stellar's own canonical XDR.
 *
 *   npx tsx packages/stellar/scripts/harvest-result-codes.ts > packages/stellar/scripts/result-codes.json
 *
 * WHY MECHANICALLY. Stellar publishes the authoritative `.x` files, so the map
 * from a number to a name is a fact we can READ rather than a fact we type from
 * memory. Same posture as scripts/harvest-deepbook.ts: the mapping is theirs,
 * the English in codes.ts is ours, and codes.test.ts fails if the two drift.
 *
 * There are 28 of these enums and they carry real negative numbers with real
 * meanings; a single transposed digit would mistranslate somebody's failed
 * payment, which is exactly the class of error typing them by hand invites.
 */
const REPO = "stellar/stellar-xdr"
const REF = "curr"
const FILES = ["Stellar-transaction.x"]

interface Harvest {
  enums: Record<string, HarvestedEnum>
  /** OperationType index -> constant, e.g. { "13": "PATH_PAYMENT_STRICT_SEND" }. */
  operationTypes: Record<string, string>
  /** Operation constant -> the enum that names ITS result codes, checked against the enums above. */
  resultEnumForOperation: Record<string, string>
  /**
   * Byte length of each operation's SUCCESS payload, or -1 when it is variable.
   *
   * This is what decides how far the result walk can get. A FAILURE case is
   * always void, so a failing operation costs three words; a SUCCESS case may
   * carry a payload, and the walk has to skip it to reach a later operation.
   * Most are void, which is why skipping is worth doing: only the DEX
   * operations (path payments, offers, inflation) carry variable-length arrays,
   * and those still stop the walk honestly.
   */
  successPayloadBytes: Record<string, number>
}

interface HarvestedEnum {
  /** e.g. "PathPaymentStrictSendResultCode" */
  name: string
  /** value -> constant name, e.g. { "-12": "PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN" } */
  values: Record<string, string>
}

async function main() {
  const out: Record<string, HarvestedEnum> = {}
  for (const file of FILES) {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${REF}/${file}`)
    if (!res.ok) throw new Error(`could not read ${file}: HTTP ${res.status}`)
    const src = await res.text()

    // enum <Name>ResultCode { ... };  Comments are stripped first: the .x files
    // annotate nearly every constant, and a `//` run can otherwise swallow a line.
    const enumRe = /enum\s+([A-Za-z0-9_]*ResultCode)\s*\{([\s\S]*?)\}\s*;/g
    let m: RegExpExecArray | null
    while ((m = enumRe.exec(src)) !== null) {
      const name = m[1]!
      const body = m[2]!.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
      const values: Record<string, string> = {}
      for (const line of body.split(",")) {
        const v = /\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*(-?\d+)/.exec(line)
        if (v) values[v[2]!] = v[1]!
      }
      if (Object.keys(values).length > 0) out[name] = { name, values }
    }
  }
  // OperationType is the discriminant that decides WHICH result enum applies to
  // an operation, so the decoder is wrong without it.
  const opSrc = await (await fetch(`https://raw.githubusercontent.com/${REPO}/${REF}/Stellar-transaction.x`)).text()
  const opBlock = /enum\s+OperationType\s*\{([\s\S]*?)\}\s*;/.exec(opSrc)
  if (!opBlock) throw new Error("OperationType enum not found; the XDR layout moved")
  const operationTypes: Record<string, string> = {}
  for (const line of opBlock[1]!.replace(/\/\/[^\n]*/g, "").split(",")) {
    const v = /([A-Z][A-Z0-9_]*)\s*=\s*(\d+)/.exec(line)
    if (v) operationTypes[v[2]!] = v[1]!
  }

  // WHICH result enum applies to an operation is not guessable and must not be
  // derived from the name: the XDR reuses ManageSellOfferResult for
  // CREATE_PASSIVE_SELL_OFFER, and spells ExtendFootprintTTLResult with TTL
  // capitalised. The `union OperationResult` block states every pairing
  // outright, so it is read rather than inferred.
  const unionBlock = /union\s+OperationResult\s+switch\s*\([\s\S]*?\n\}\s*;/.exec(opSrc)
  if (!unionBlock) throw new Error("union OperationResult not found; the XDR layout moved")
  const resultEnumForOperation: Record<string, string> = {}
  const pairRe = /case\s+([A-Z][A-Z0-9_]*)\s*:\s*(?:\s*case\s+[A-Z][A-Z0-9_]*\s*:\s*)*\s*([A-Za-z0-9_]+)Result\s+[A-Za-z0-9_]+\s*;/g
  let pm: RegExpExecArray | null
  while ((pm = pairRe.exec(unionBlock[0])) !== null) {
    const enumName = `${pm[2]!}ResultCode`
    if (out[enumName]) resultEnumForOperation[pm[1]!] = enumName
  }
  const missing = Object.values(operationTypes).filter(c => !resultEnumForOperation[c])
  if (missing.length > 0) throw new Error(`no result enum resolved for: ${missing.join(", ")}`)

  // Fixed-size XDR types we can skip. Anything not listed, and anything holding
  // a variable-length array, stops the walk rather than being guessed at.
  const FIXED: Record<string, number> = {
    "void": 0,
    "int64": 8,
    "Hash": 32,
    // union switch (ClaimableBalanceIDType) { case V0: Hash v0; } = 4 + 32
    "ClaimableBalanceID": 36,
  }
  const successPayloadBytes: Record<string, number> = {}
  for (const [constant, enumName] of Object.entries(resultEnumForOperation)) {
    const unionName = enumName.replace(/Code$/, "")
    const u = new RegExp(`union\\s+${unionName}\\s+switch\\s*\\([\\s\\S]*?\\n\\}\\s*;`).exec(opSrc)
    if (!u) { successPayloadBytes[constant] = -1; continue }
    const afterSuccess = /case\s+[A-Z][A-Z0-9_]*_SUCCESS\s*:([\s\S]*?)(?=\ncase\s|\n\}\s*;)/.exec(u[0])
    if (!afterSuccess) { successPayloadBytes[constant] = -1; continue }
    const body = afterSuccess[1]!.replace(/\/\/[^\n]*/g, "").trim()
    if (/<>/.test(body) || /\bstruct\b/.test(body)) { successPayloadBytes[constant] = -1; continue }
    const typeName = /^([A-Za-z][A-Za-z0-9_]*)\b/.exec(body)?.[1] ?? ""
    successPayloadBytes[constant] = typeName in FIXED ? FIXED[typeName]! : -1
  }
  const skippable = Object.values(successPayloadBytes).filter(n => n >= 0).length
  process.stderr.write(`${skippable} of ${Object.keys(successPayloadBytes).length} operation successes are a fixed size and can be skipped\n`)

  const count = Object.values(out).reduce((n, e) => n + Object.keys(e.values).length, 0)
  if (Object.keys(out).length < 20) throw new Error(`only found ${Object.keys(out).length} enums; the XDR layout moved`)
  process.stderr.write(`${Object.keys(out).length} enums, ${count} codes, ${Object.keys(operationTypes).length} operation types\n`)
  const harvest: Harvest = { enums: out, operationTypes, resultEnumForOperation, successPayloadBytes }
  process.stdout.write(JSON.stringify(harvest, null, 2) + "\n")
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
