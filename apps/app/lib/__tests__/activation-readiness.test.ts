import { describe, it, expect } from "vitest"
import { buildChecklist, type ChecklistInput, type WalletFacts } from "@/lib/activation/readiness"

const ok = <T,>(value: T) => ({ kind: "ok" as const, value })
const unavailable = { kind: "unavailable" as const }

function facts(over: Partial<WalletFacts> = {}): WalletFacts {
  return {
    walletChain: { id: "0xa86a", name: "Avalanche" },
    gas: ok({ hasAny: true, coversOneTx: true }),
    asset: null,
    approvals: null,
    failure: null,
    ...over,
  }
}

function input(over: Partial<ChecklistInput> = {}, f: Partial<WalletFacts> = {}): ChecklistInput {
  return {
    projectName: "Benqi",
    action: "deposit",
    spends: { kind: "tokens", tokens: [{ address: "0xusdc", symbol: "USDC" }] },
    actionChain: { id: "0xa86a", name: "Avalanche", nativeSymbol: "AVAX", evm: true },
    facts: facts(f),
    ...over,
  }
}

const ids = (c: ReturnType<typeof buildChecklist>) => c.items.map(i => `${i.id}:${i.status}`)

describe("readiness checklist", () => {
  it("says ready when every check passed, and counts only what it checked", () => {
    const c = buildChecklist(input({}, {
      asset: ok({ held: ["USDC"], wanted: ["USDC"], elsewhere: [] }),
      approvals: ok([{ symbol: "USDC", approved: true }]),
    }))
    expect(c.headline).toBe("You're ready for your first deposit")
    expect(c.todo).toBe(0)
    expect(c.ready).toBe(c.checkable)
    expect(ids(c)).toEqual(["network:ready", "gas:ready", "asset:ready", "approval:ready"])
  })

  it("leads with what is ready, then what to do, then what to expect, then what it could not check", () => {
    const c = buildChecklist(input({}, {
      walletChain: { id: "0x1", name: "Ethereum" },
      gas: unavailable,
      asset: ok({ held: ["USDC"], wanted: ["USDC"], elsewhere: [] }),
      approvals: ok([{ symbol: "USDC", approved: false }]),
    }))
    expect(ids(c)).toEqual(["asset:ready", "network:todo", "approval:expect", "gas:unknown"])
  })

  it("puts a failed attempt above everything, with its decoded reason", () => {
    const c = buildChecklist(input({}, {
      failure: { source: "history", when: "4 minutes ago", reason: "The price moved beyond your slippage limit." },
    }))
    expect(c.items[0]).toMatchObject({ id: "failure", status: "todo" })
    expect(c.items[0]!.detail).toContain("The price moved beyond your slippage limit.")
    expect(c.items[0]!.ask).toBeTruthy()
  })

  it("asks about the exact hash the host reported", () => {
    const c = buildChecklist(input({}, { failure: { source: "host", hash: "0xabc" } }))
    expect(c.items[0]!.ask).toContain("0xabc")
  })

  // THE ABSENCE RULE. A read that did not complete is not "you have none".
  it("never turns a failed balance read into a claim about the wallet", () => {
    const c = buildChecklist(input({}, { gas: unavailable, asset: unavailable, approvals: unavailable }))
    const unknown = c.items.filter(i => i.status === "unknown")
    expect(unknown.map(i => i.id).sort()).toEqual(["approval", "asset", "gas"])
    for (const i of unknown) {
      expect(`${i.title} ${i.detail ?? ""}`).not.toMatch(/\b(no|none|don't|doesn't|empty|zero)\b/i)
      expect(i.detail).toMatch(/couldn't check/i)
    }
    // Unknowns are neither ready nor counted as checkable.
    expect(c.checkable).toBe(1)
    expect(c.headline).not.toMatch(/ready for your first/)
  })

  it("does not call the wallet ready when part of it could not be checked", () => {
    const c = buildChecklist(input({}, { gas: unavailable }))
    expect(c.todo).toBe(0)
    expect(c.headline).toBe("Nothing to fix in what I could check")
  })

  it("names only the action chain when the token is nowhere, never other chains it failed to read", () => {
    const c = buildChecklist(input({}, { asset: ok({ held: [], wanted: ["USDC", "USDT"], elsewhere: [] }) }))
    const a = c.items.find(i => i.id === "asset")!
    expect(a.status).toBe("todo")
    expect(a.title).toBe("Get USDC or USDT on Avalanche")
    expect(a.detail).toContain("on Avalanche")
  })

  it("says where the token is when it is on another chain", () => {
    const c = buildChecklist(input({}, {
      asset: ok({ held: [], wanted: ["USDC"], elsewhere: [{ symbol: "USDC", chainName: "Arbitrum" }] }),
    }))
    const a = c.items.find(i => i.id === "asset")!
    expect(a).toMatchObject({ status: "todo", title: "Your USDC is on Arbitrum" })
    expect(a.detail).toBe("It needs to be on Avalanche to deposit here.")
  })

  it("distinguishes no gas at all from not enough for one transaction", () => {
    const none = buildChecklist(input({}, { gas: ok({ hasAny: false, coversOneTx: false }) }))
    const low = buildChecklist(input({}, { gas: ok({ hasAny: true, coversOneTx: false }) }))
    expect(none.items.find(i => i.id === "gas")!.title).toBe("Get AVAX for network fees")
    expect(low.items.find(i => i.id === "gas")!.title).toBe("Top up AVAX for network fees")
  })

  it("treats an unknown fee estimate as having gas, not as too little", () => {
    const c = buildChecklist(input({}, { gas: ok({ hasAny: true, coversOneTx: null }) }))
    expect(c.items.find(i => i.id === "gas")!.status).toBe("ready")
  })

  it("merges gas and asset when the action itself is paid in the native coin", () => {
    const c = buildChecklist(input({ action: "stake", spends: { kind: "native" } }, { gas: ok({ hasAny: false, coversOneTx: false }) }))
    expect(c.items.filter(i => i.id === "gas" || i.id === "asset")).toHaveLength(1)
    const g = c.items.find(i => i.id === "gas")!
    expect(g.title).toBe("Get AVAX on Avalanche")
    expect(g.detail).toContain("both the stake itself and its network fee")
  })

  it("warns about the approve step for any-token actions on EVM, and not elsewhere", () => {
    const evm = buildChecklist(input({ action: "swap", spends: { kind: "any" } }))
    expect(evm.items.find(i => i.id === "approval")?.status).toBe("expect")
    const aptos = buildChecklist(input({
      action: "swap",
      spends: { kind: "any" },
      actionChain: { id: "aptos", name: "Aptos", nativeSymbol: "APT", evm: false },
    }, { walletChain: { id: "aptos", name: "Aptos" } }))
    expect(aptos.items.find(i => i.id === "approval")).toBeUndefined()
  })

  it("still gives the approve heads-up when there is no specific token to check", () => {
    const c = buildChecklist(input({}, { approvals: null }))
    expect(c.items.find(i => i.id === "approval")).toMatchObject({ status: "expect", title: "Your wallet may ask you to approve a token first" })
  })

  it("has no approval item when the action is paid in the native coin", () => {
    const c = buildChecklist(input({ action: "stake", spends: { kind: "native" } }))
    expect(c.items.find(i => i.id === "approval")).toBeUndefined()
  })

  it("omits the network item when the wallet's chain is not known", () => {
    const c = buildChecklist(input({}, { walletChain: null }))
    expect(c.items.find(i => i.id === "network")).toBeUndefined()
  })

  it("counts things to do, and says so in the headline", () => {
    const c = buildChecklist(input({}, {
      walletChain: { id: "0x1", name: "Ethereum" },
      gas: ok({ hasAny: false, coversOneTx: false }),
    }))
    expect(c.todo).toBe(2)
    expect(c.headline).toBe("2 things to sort before your first deposit")
  })

  // Rules carried over from the opener: facts only, no amounts, no advice.
  it("never states an amount or tells the user what to choose", () => {
    const every = [
      buildChecklist(input({}, {
        walletChain: { id: "0x1", name: "Ethereum" },
        gas: ok({ hasAny: true, coversOneTx: false }),
        asset: ok({ held: [], wanted: ["USDC"], elsewhere: [{ symbol: "USDC", chainName: "Arbitrum" }] }),
        failure: { source: "history", when: "just now" },
      })),
      buildChecklist(input({ spends: { kind: "any" } })),
      buildChecklist(input({ spends: { kind: "native" }, action: "stake" }, { gas: ok({ hasAny: false, coversOneTx: false }) })),
    ]
    for (const c of every) {
      for (const i of c.items) {
        const text = `${i.title} ${i.detail ?? ""}`
        expect(text).not.toMatch(/\d/)
        expect(text).not.toMatch(/\$|\bshould\b|\brecommend|\bbest\b|\bcheapest\b/i)
      }
    }
  })
})
