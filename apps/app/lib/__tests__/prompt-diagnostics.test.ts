import { describe, expect, it } from "vitest"
import { buildSystemPrompt } from "@txid/ai"

// A protocol can turn on-chain diagnosis OFF (config.diagnostics === false):
// the assistant answers from docs and takes bug reports, but must NEVER try to
// debug a transaction. This locks the prompt half of that promise (the tool
// half is enforced in stream.ts). Driven by the Yamata pilot, where a wrong
// debug suggestion was an explicit, agreed no-go.

const snapshot = {
  token: null,
  watchedContracts: [
    { address: "0xf64b0b318aaf83bd9071110af24d24445719a07f", chain: "0x38", name: "Core", description: "core" },
  ],
  docsUrl: null,
} as unknown as Parameters<typeof buildSystemPrompt>[0]["config"]

function prompt(diagnostics?: boolean): string {
  return buildSystemPrompt({
    projectName: "Yamata",
    config: snapshot,
    mode: "support",
    beta: { feedback: true, bugs: true },
    ...(diagnostics === undefined ? {} : { diagnostics }),
  })
}

describe("buildSystemPrompt diagnostics switch", () => {
  it("diagnostics ON (default) keeps transaction diagnosis + contracts", () => {
    const p = prompt(undefined)
    expect(p).toContain("## Smart Contracts")
    expect(p).toContain("target shape for a failed transaction")
    expect(p).not.toContain("You do not diagnose transactions")
  })

  it("bug capture requires the user's goal before filing, on every path", () => {
    // Husien (Yamata): "they should be asked to explain the issue when raising
    // a ticket... right now I don't see that constraint". The constraint: no
    // report may record only THAT something failed, and the model must never
    // file in the same turn it asks a question (that locks the report before
    // the answer exists; seen live as the widget flipping back to Support
    // mid-interview). Applies in both diagnostics modes.
    for (const p of [prompt(undefined), prompt(false)]) {
      expect(p).toContain("never file a report that only records THAT something failed")
      expect(p).toContain("NEVER call create_support_ticket in the same turn you ask a question")
      expect(p).toContain("What were you trying to do")
    }
  })

  it("diagnostics OFF refuses transactions and drops the diagnosis apparatus", () => {
    const p = prompt(false)
    expect(p).toContain("You do not diagnose transactions")
    // the contract listing + tx scope block are gone
    expect(p).not.toContain("## Smart Contracts")
    // the failed-transaction target shape (a diagnosis instruction) is gone
    expect(p).not.toContain("target shape for a failed transaction")
    // and the scope line no longer tells it to diagnose the user's own txs
    expect(p).not.toContain("Diagnose the user's OWN transactions")
    // bug reporting stays available
    expect(p).toContain("bug")
  })
})
