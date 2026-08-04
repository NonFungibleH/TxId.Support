import type { Metadata } from "next"

export const metadata: Metadata = { title: "Feature List" }

type Status = "Available" | "Optional" | "Coming" | "Paused"

const STATUS_STYLE: Record<Status, string> = {
  Available: "border-emerald-800 bg-emerald-950/40 text-emerald-400",
  Optional: "border-sky-800 bg-sky-950/40 text-sky-400",
  Coming: "border-amber-800 bg-amber-950/40 text-amber-400",
  Paused: "border-[#2a2a2a] bg-[#141414] text-[#71717a]",
}

interface Row {
  feature: string
  detail: string
  status: Status
}

const SECTIONS: { title: string; note?: string; rows: Row[] }[] = [
  {
    title: "Deployment surfaces",
    note: "One engine, several places to put it.",
    rows: [
      { feature: "Embedded widget", detail: "One script tag. Works with React, Next.js, Vue, Svelte or plain HTML.", status: "Available" },
      { feature: "Inline embed", detail: "Render inside a container instead of a floating button.", status: "Available" },
      { feature: "React component", detail: "@txid/react for direct integration.", status: "Available" },
      { feature: "Telegram bot", detail: "One bot per protocol, connected with a BotFather token.", status: "Available" },
      { feature: "REST API", detail: "POST /api/v1/diagnose, server to server with a secret key.", status: "Available" },
      { feature: "MCP server", detail: "On-chain diagnostics as tools for MCP-compatible AI clients.", status: "Coming" },
    ],
  },
  {
    title: "Transaction diagnostics",
    note: "Why a transaction failed, in plain English.",
    rows: [
      { feature: "Failure diagnosis", detail: "Replays the transaction and explains the cause.", status: "Available" },
      { feature: "Revert reasons", detail: "require() strings decoded and translated.", status: "Available" },
      { feature: "Custom errors", detail: "Solidity custom errors decoded via stored ABI or 4byte.directory.", status: "Available" },
      { feature: "Solidity panics", detail: "Overflow, division by zero, array bounds, failed assert.", status: "Available" },
      { feature: "Out of gas", detail: "Detected from gas used against the limit, without an extra RPC call.", status: "Available" },
      { feature: "Move aborts", detail: "Aptos abort codes decoded against framework and protocol error maps.", status: "Available" },
      { feature: "Stuck and pending", detail: "Nonce gaps and underpriced transactions identified as such.", status: "Available" },
      { feature: "Error glossary", detail: "Your own plain-English explanation per contract error, used verbatim.", status: "Available" },
    ],
  },
  {
    title: "Wallet and account intelligence",
    rows: [
      { feature: "Wallet detection", detail: "MetaMask, WalletConnect, Coinbase Wallet, Petra, Martian.", status: "Available" },
      { feature: "Address paste", detail: "Answers without connecting a wallet at all.", status: "Available" },
      { feature: "Balances", detail: "Native, ERC-20, and Aptos fungible assets.", status: "Available" },
      { feature: "Transaction history", detail: "Recent activity, scoped to your contracts when useful.", status: "Available" },
      { feature: "Token approvals", detail: "Open allowances, including unlimited grants. EVM only.", status: "Available" },
      { feature: "Name resolution", detail: "ENS on EVM, Aptos Name Service (.apt) on Aptos.", status: "Available" },
      { feature: "Protocol accounts", detail: "Resolves a wallet to the protocol's own account object, so delegated-trading balances are not reported as empty.", status: "Available" },
      { feature: "Merged history", detail: "Wallet and protocol-account activity combined, with the origin of each labelled.", status: "Available" },
    ],
  },
  {
    title: "Contract and token intelligence",
    rows: [
      { feature: "Contract verification", detail: "Source-verified status, proxy configuration, upgrade history.", status: "Available" },
      { feature: "Live contract state", detail: "Reads current values from the chain, not from a cache.", status: "Available" },
      { feature: "Contract events", detail: "Indexed on EVM. On Aptos, recovered by scanning a stated window.", status: "Available" },
      { feature: "Move module ABIs", detail: "Read on-chain, so there is nothing to upload.", status: "Available" },
      { feature: "Token information", detail: "Supply, decimals, live DEX price, allowances.", status: "Available" },
      { feature: "Token safety", detail: "Honeypot and fee-on-transfer signals. EVM only.", status: "Available" },
      { feature: "Network status", detail: "Gas conditions, fee guidance, node responsiveness.", status: "Available" },
    ],
  },
  {
    title: "Protocol-aware answers",
    note: "Configured per protocol. The perpetuals set below is what a venue like Decibel exposes.",
    rows: [
      { feature: "Positions and collateral", detail: "Size, side, entry, leverage and margin mode, in dollars and units.", status: "Available" },
      { feature: "Unrealised PnL", detail: "Live oracle price against entry, per position.", status: "Available" },
      { feature: "Liquidation risk", detail: "The contract's own liquidation check, plus equity against the threshold.", status: "Available" },
      { feature: "Order constraints", detail: "Minimum size, size increment, maximum leverage, market open state.", status: "Available" },
      { feature: "Pending orders", detail: "Accepted but not yet matched, across every market.", status: "Available" },
      { feature: "Pending withdrawals", detail: "Answers \"where is my withdrawal?\" from the queue itself.", status: "Available" },
      { feature: "Funding and stops", detail: "Complete funding cost, and whether a stop or take profit is set.", status: "Available" },
    ],
  },
  {
    title: "Knowledge",
    rows: [
      { feature: "Documentation indexing", detail: "Crawls your docs and answers from them, with sources.", status: "Available" },
      { feature: "Grounded answers", detail: "Says so when something cannot be verified, rather than guessing.", status: "Available" },
      { feature: "Content blocks", detail: "Fixed answers for questions you want worded exactly.", status: "Available" },
      { feature: "Languages", detail: "16 supported, or auto-detected from the user.", status: "Available" },
    ],
  },
  {
    title: "The case record",
    note: "What is kept after the conversation ends.",
    rows: [
      { feature: "Full investigation", detail: "Question, evidence, reasoning and resolution, not just a transcript.", status: "Available" },
      { feature: "Summaries and tags", detail: "One-line summary, category and sentiment per conversation.", status: "Available" },
      { feature: "Chain state", detail: "The ledger version an answer was true as of, so it can be replayed.", status: "Available" },
      { feature: "Prices at read time", detail: "The prices a figure rested on, kept with the answer.", status: "Available" },
      { feature: "Failed lookups", detail: "Reads that did not happen, so a thin answer is never mistaken for a complete one.", status: "Available" },
      { feature: "Request context", detail: "Country, coarse device, surface and language. No IP address is stored.", status: "Available" },
      { feature: "Append-only", detail: "Enforced in the database: content and evidence cannot be rewritten.", status: "Available" },
      { feature: "Access log", detail: "Who viewed, exported or erased a record, and when.", status: "Available" },
      { feature: "Recorded erasure", detail: "Deletion leaves a tombstone, so a gap is never unexplained.", status: "Available" },
      { feature: "CSV export", detail: "Includes ledger version, country, model and answer hash.", status: "Available" },
      { feature: "Full-text case search", detail: "Search across the whole record set.", status: "Coming" },
      { feature: "Retention controls", detail: "Configurable per project, and enforced.", status: "Coming" },
      { feature: "SOC 2 audit", detail: "Not held today.", status: "Coming" },
    ],
  },
  {
    title: "Escalation and workflow",
    rows: [
      { feature: "Support tickets", detail: "Raised from the widget or the dashboard, with the investigation attached.", status: "Available" },
      { feature: "Notifications", detail: "Slack, Discord, Telegram.", status: "Available" },
      { feature: "Issue trackers", detail: "Linear, GitHub, Jira. The issue URL is written back to the ticket.", status: "Available" },
      { feature: "Outbound webhooks", detail: "HMAC-signed, with a delivery log.", status: "Available" },
    ],
  },
  {
    title: "Analytics",
    rows: [
      { feature: "Volume and trends", detail: "Conversations over time, by chain.", status: "Available" },
      { feature: "Categories and sentiment", detail: "What users ask about, and how those conversations end.", status: "Available" },
      { feature: "Gaps view", detail: "What was marked unhelpful, escalated, or ended badly without escalating.", status: "Available" },
      { feature: "Knowledge vs data gaps", detail: "Separates missing documentation from failed chain reads, since the fixes differ.", status: "Available" },
    ],
  },
  {
    title: "Branding and configuration",
    rows: [
      { feature: "White-label", detail: "Your colours, font, logo, agent name and avatar.", status: "Available" },
      { feature: "Placement", detail: "Bottom-right, bottom-left, or inline in a container.", status: "Available" },
      { feature: "Live preview", detail: "Updates as you type, before anything goes live.", status: "Available" },
      { feature: "Go-live control", detail: "Show or hide the widget without touching your code.", status: "Available" },
    ],
  },
  {
    title: "Trust and safety",
    rows: [
      { feature: "Read-only", detail: "No keys, no signing, no custody. Nothing can move funds.", status: "Available" },
      { feature: "Sanctions screening", detail: "On request, against the on-chain oracle, with the source cited. EVM only.", status: "Available" },
      { feature: "Audit references", detail: "Your audits surfaced when users ask about security.", status: "Available" },
      { feature: "Abuse protection", detail: "Invisible Turnstile and per-IP rate limits on public surfaces.", status: "Available" },
      { feature: "Actions", detail: "User-authorised transactions, signed in the user's own wallet. Off by default, paid plans only.", status: "Optional" },
    ],
  },
  {
    title: "Chains",
    rows: [
      { feature: "Aptos", detail: "Move-native: modules, resources, aborts and protocol accounts.", status: "Available" },
      { feature: "Ethereum, Base, Arbitrum, Optimism", detail: "Full EVM diagnosis.", status: "Available" },
      { feature: "BNB Chain, Polygon, Avalanche", detail: "Full EVM diagnosis.", status: "Available" },
      { feature: "Etherlink", detail: "Tezos EVM Layer 2, via Blockscout.", status: "Available" },
      { feature: "Solana", detail: "Plumbing in place, hidden in the interface for now.", status: "Paused" },
    ],
  },
]

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  )
}

export default function FeatureListPage() {
  const total = SECTIONS.reduce((n, s) => n + s.rows.length, 0)
  const available = SECTIONS.reduce(
    (n, s) => n + s.rows.filter(r => r.status === "Available").length,
    0,
  )

  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 not-prose">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Reference</p>
        <h1 className="text-3xl font-bold text-white">Feature list</h1>
        <p className="mt-2 text-[#a1a1aa]">
          Everything TxID does, in one place. {available} of {total} are available today; the rest
          are marked so nothing here reads as shipped when it is not.
        </p>
      </div>

      <div className="not-prose mb-8 flex flex-wrap gap-2 text-[11px]">
        {(["Available", "Optional", "Coming", "Paused"] as Status[]).map(s => (
          <span key={s} className="flex items-center gap-1.5">
            <StatusPill status={s} />
            <span className="text-[#71717a]">
              {s === "Available" && "in production"}
              {s === "Optional" && "off unless you enable it"}
              {s === "Coming" && "on the roadmap, not built"}
              {s === "Paused" && "built, hidden for now"}
            </span>
          </span>
        ))}
      </div>

      {SECTIONS.map(section => (
        <section key={section.title} className="not-prose mb-10">
          <h2 className="mb-1 text-lg font-semibold text-white">{section.title}</h2>
          {section.note && <p className="mb-3 text-sm text-[#71717a]">{section.note}</p>}
          <div className="overflow-x-auto rounded-lg border border-[#1f1f1f]">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {section.rows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i > 0 ? "border-t border-[#1f1f1f]" : undefined}
                  >
                    <td className="w-[220px] px-4 py-3 align-top font-medium text-white">
                      {row.feature}
                    </td>
                    <td className="px-4 py-3 align-top text-[#a1a1aa]">{row.detail}</td>
                    <td className="w-[110px] px-4 py-3 align-top text-right">
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="not-prose rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] p-5">
        <p className="text-sm text-[#a1a1aa]">
          Something you need that is not listed? Tell us what you are building at{" "}
          <a href="mailto:team@txid.support" className="text-accent hover:underline">
            team@txid.support
          </a>
          . Anything marked Coming is genuinely not built yet, and we would rather say so.
        </p>
      </div>
    </article>
  )
}
