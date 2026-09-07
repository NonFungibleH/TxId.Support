import { describe, it, expect, vi, afterEach } from "vitest"
import { getSuiTransaction, getSuiBalance } from "./client"

const REAL_DIGEST = "D7ynWjYGsTonq5XvPCbcoo7LmxCA1wC4Z2H3nt7xjSuz"
const ADDR = "0xffd4f04305720000000000000000000000000000000000000000000000000000"

const jsonRes = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })

afterEach(() => vi.unstubAllGlobals())

describe("Sui reads distinguish three outcomes", () => {
  // Verified against mainnet: a genuine miss says exactly this, while malformed
  // input says "Invalid params". They are different facts and must not merge.
  it("a genuine miss is not_found, not unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({
      jsonrpc: "2.0", id: 1,
      error: { code: -32602, message: "Could not find the referenced transaction [TransactionDigest(...)]" },
    })))
    expect((await getSuiTransaction(REAL_DIGEST)).kind).toBe("not_found")
  })

  it("an unreachable node is unavailable, never not_found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })))
    const r = await getSuiTransaction(REAL_DIGEST)
    expect(r.kind).toBe("unavailable")
    expect(r.kind === "unavailable" && r.reason).toMatch(/503/)
  })

  it("a network that never answers is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up") }))
    expect((await getSuiTransaction(REAL_DIGEST)).kind).toBe("unavailable")
  })

  // Sui's own fullnode is dead and we ride on third-party endpoints, so one
  // being down must not take the chain down with it.
  it("falls through to the second endpoint when the first fails", async () => {
    const calls: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url)
      if (calls.length === 1) return new Response("", { status: 502 })
      return jsonRes({ jsonrpc: "2.0", id: 1, result: { digest: REAL_DIGEST, effects: { status: { status: "success" } } } })
    }))
    const r = await getSuiTransaction(REAL_DIGEST)
    expect(r.kind).toBe("ok")
    expect(calls.length).toBe(2)
    expect(new Set(calls).size).toBe(2)
  })

  it("rejects a malformed digest without blaming the network", async () => {
    const r = await getSuiTransaction("not-a-digest")
    expect(r.kind).toBe("unavailable")
    expect(r.kind === "unavailable" && r.reason).toMatch(/not a Sui transaction digest/)
  })

  it("decodes the abort on a failed transaction", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({
      jsonrpc: "2.0", id: 1,
      result: {
        digest: REAL_DIGEST,
        effects: {
          status: { status: "failure", error: 'MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("balance_manager") }, function: 7, instruction: 3, function_name: Some("withdraw_with_proof") }, 3) in command 1' },
          gasUsed: { computationCost: "1000000", storageCost: "2000000", storageRebate: "500000" },
        },
      },
    })))
    const r = await getSuiTransaction(REAL_DIGEST)
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") return
    expect(r.value.status).toBe("failed")
    expect(r.value.decodedAbort?.module).toBe("balance_manager")
    expect(r.value.decodedAbort?.code).toBe(3)
    expect(r.value.decodedAbort?.command).toBe(1)
    // gas = computation + storage - rebate
    expect(r.value.gasUsed).toBe("2500000")
    expect(r.value.gasFormatted).toBe("0.0025 SUI")
  })

  // An empty wallet is a real answer. Only the tri-state can say that without
  // it being confusable with a read that never happened.
  it("an empty balance is ok, not a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ jsonrpc: "2.0", id: 1, result: [] })))
    const r = await getSuiBalance(ADDR)
    expect(r.kind).toBe("ok")
    expect(r.kind === "ok" && r.value.sui).toBe("0")
  })

  // Coin decimals live on a separate metadata object. We do not fetch them, so
  // we must not imply we know the scale: null means NOT READ, never zero.
  it("never guesses a coin's decimals", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({
      jsonrpc: "2.0", id: 1,
      result: [
        { coinType: "0x2::sui::SUI", totalBalance: "1500000000" },
        { coinType: "0xabc::usdc::USDC", totalBalance: "12345678" },
      ],
    })))
    const r = await getSuiBalance(ADDR)
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") return
    expect(r.value.sui).toBe("1.5")
    expect(r.value.coins[0]?.decimals).toBeNull()
    expect(r.value.coins[0]?.symbol).toBe("USDC")
  })
})

// Sui gas is computation + storage LESS the storage rebate, and a transaction
// that frees more storage than it takes ends up net negative. Seen live on
// 2026-09-07 at -0.0008 SUI, on a failed transaction, which would have reached
// a worried user as "gas: -0.0008 SUI" beside "only the gas was spent".
describe("net gas can be negative, and must not be shown as a minus sign", () => {
  const txWith = (gasUsed: Record<string, string>) => jsonRes({
    jsonrpc: "2.0", id: 1,
    result: {
      digest: REAL_DIGEST,
      effects: { status: { status: "failure", error: "InsufficientCoinBalance in command 1" }, gasUsed },
      transaction: { data: { sender: ADDR } },
    },
  })

  it("says what happened to the balance when the rebate exceeded the cost", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => txWith({
      computationCost: "234000", storageCost: "20132400", storageRebate: "21166400",
    })))
    const r = await getSuiTransaction(REAL_DIGEST)
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") return
    expect(r.value.gasFormatted).not.toMatch(/^-/)
    expect(r.value.gasFormatted).toMatch(/returned/)
    expect(r.value.gasFormatted).toMatch(/storage rebate/)
    // The signed net is still available to anything that needs to compute.
    expect(r.value.gasUsed).toBe("-800000")
  })

  it("formats an ordinary positive cost unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => txWith({
      computationCost: "234000", storageCost: "20132400", storageRebate: "19931076",
    })))
    const r = await getSuiTransaction(REAL_DIGEST)
    expect(r.kind === "ok" && r.value.gasFormatted).toBe("0.0004 SUI")
  })

  it("reports null rather than zero when the node gave no gas figures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({
      jsonrpc: "2.0", id: 1,
      result: { digest: REAL_DIGEST, effects: { status: { status: "success" } }, transaction: { data: { sender: ADDR } } },
    })))
    const r = await getSuiTransaction(REAL_DIGEST)
    expect(r.kind === "ok" && r.value.gasUsed).toBeNull()
    expect(r.kind === "ok" && r.value.gasFormatted).toBeNull()
  })
})
