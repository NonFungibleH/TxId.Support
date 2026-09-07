import { describe, it, expect, vi, afterEach } from "vitest"
import { resolveOriginalPackage, __clearPackageOriginCache } from "./package"

const ORIGINAL = "0x2c8d603bc51326b8c13cef9dd07031a408a48dddb541963357661df5d3204809"
const RUNTIME = "0xcaf6ba059d539a97646d47f0b9ddf843e138d215e2a12ca1f4585d386f7aec3a"

const jsonRes = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })

afterEach(() => { vi.unstubAllGlobals(); __clearPackageOriginCache() })

describe("resolving a Sui package to the address it was first published at", () => {
  // Verified live: all three DeepBook runtime addresses report this original.
  it("returns the original id the module reports", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ jsonrpc: "2.0", id: 1, result: { address: ORIGINAL, name: "balance_manager" } })))
    const r = await resolveOriginalPackage(RUNTIME, "balance_manager")
    expect(r).toEqual({ kind: "ok", original: ORIGINAL })
  })

  // The whole point of the tri-state. "We could not ask which package this is"
  // and "this package publishes no description for that code" read identically
  // to a user and have opposite fixes, so they must not collapse.
  it("an unreachable node is unavailable, never unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })))
    const r = await resolveOriginalPackage(RUNTIME, "balance_manager")
    expect(r.kind).toBe("unavailable")
    expect(r.kind === "unavailable" && r.reason).toMatch(/503/)
  })

  it("a node that has never heard of the package is answering, so that is unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({
      jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Package object does not exist with ID ..." },
    })))
    expect((await resolveOriginalPackage(RUNTIME, "balance_manager")).kind).toBe("unknown")
  })

  it("normalises whatever spelling the node returns", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ jsonrpc: "2.0", id: 1, result: { address: "0x2" } })))
    const r = await resolveOriginalPackage(RUNTIME, "coin")
    expect(r.kind === "ok" && r.original).toBe("0x" + "2".padStart(64, "0"))
  })

  it("rejects a malformed package or module without calling out", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect((await resolveOriginalPackage("not-an-address", "coin")).kind).toBe("unknown")
    expect((await resolveOriginalPackage(RUNTIME, "has spaces")).kind).toBe("unknown")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Package ids are immutable, so a list of failures from one protocol should
  // cost exactly one call however many rows it holds.
  it("asks once per package and module", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ jsonrpc: "2.0", id: 1, result: { address: ORIGINAL } }))
    vi.stubGlobal("fetch", fetchMock)
    await resolveOriginalPackage(RUNTIME, "balance_manager")
    await resolveOriginalPackage(RUNTIME, "balance_manager")
    await resolveOriginalPackage(RUNTIME.toUpperCase().replace("0X", "0x"), "balance_manager")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not cache a failure", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 500 }))
    vi.stubGlobal("fetch", fetchMock)
    await resolveOriginalPackage(RUNTIME, "balance_manager")
    await resolveOriginalPackage(RUNTIME, "balance_manager")
    // Two attempts, each across both default endpoints.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4)
  })
})
