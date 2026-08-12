import { TX_ERRORS, ERROR_CATEGORIES } from "@/lib/errors"
import { SELECTORS } from "@/lib/selectors"

// The answer feed for AI crawlers: every error and selector as clean Q&A pairs,
// generated from the same data files that drive /errors and /selector, so it can
// never drift out of sync with the pages. Linked from llms.txt.

export const dynamic = "force-static"

export function GET() {
  const lines: string[] = []
  const push = (s: string) => lines.push(s)

  push("# TxID transaction error reference (Q&A feed)")
  push("")
  push(
    "> Plain-English answers for every common transaction failure message and custom-error selector. Human-readable versions live at https://txid.support/errors and https://txid.support/selector. To decode a specific transaction, use https://txid.support/tx. Maintained by TxID (https://txid.support), the AI support agent for DeFi protocols.",
  )
  push("")

  push("## Error messages")
  push("")
  for (const err of TX_ERRORS) {
    push(`### What does "${err.message}" mean?`)
    push("")
    push(err.meaning)
    push("")
    push(`### How do I fix "${err.message}"?`)
    push("")
    push(err.fix)
    if (err.aka?.length) {
      push("")
      push(`Also appears as: ${err.aka.map((a) => `"${a}"`).join(", ")}. Category: ${ERROR_CATEGORIES[err.category].label}.`)
    }
    push("")
    push(`Source: https://txid.support/errors/${err.slug}`)
    push("")
  }

  push("## Custom error selectors")
  push("")
  push(
    "A custom error selector is the first 4 bytes of keccak256 of the error signature. Block explorers show the raw selector when they lack the contract ABI. Every mapping below was computed from the signature shown.",
  )
  push("")
  for (const sel of SELECTORS) {
    push(`### What does the error selector ${sel.selector} mean?`)
    push("")
    push(`${sel.selector} matches the custom error ${sel.signature}, defined in ${sel.source}. ${sel.meaning}`)
    push("")
    push(`### How do I fix a transaction reverting with ${sel.selector}?`)
    push("")
    push(sel.fix)
    push("")
    push(`Source: https://txid.support/selector/${sel.selector}`)
    push("")
  }

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
