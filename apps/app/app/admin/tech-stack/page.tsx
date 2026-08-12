import Link from "next/link"
import { notFound } from "next/navigation"
import { currentUserEmail, isAdminEmail } from "@/lib/admin-auth"

// A talking-doc for demos and CTO conversations. Everything below is what we
// actually run, described the way it would be said out loud. Keep it in step
// with CLAUDE.md when the stack changes.

type Tool = { name: string; use: string }
type Group = { label: string; tools: Tool[] }

const STACK: Group[] = [
  {
    label: "Platform & framework",
    tools: [
      { name: "Next.js 14 (App Router)", use: "One codebase runs the whole product: the marketing site, the customer dashboard, the embeddable widget, and the API." },
      { name: "TypeScript", use: "Everything is typed end to end, on strict settings, so a field that could be missing can't silently slip through." },
      { name: "Turborepo + pnpm", use: "A single monorepo holds the apps and the shared packages (AI, EVM, Solana, Aptos), so each chain's logic is written once and reused everywhere." },
      { name: "Vercel", use: "Hosting and deploys. Every pull request gets a live preview; merging to the protected branch ships to production." },
    ],
  },
  {
    label: "Data & authentication",
    tools: [
      { name: "Supabase (Postgres + pgvector)", use: "Our database. Holds projects, conversations, the compliance case records, and the vector embeddings of each customer's documentation for search." },
      { name: "Clerk", use: "Login, multi-company organisations, and team invitations. Our own four-role permission layer sits on top of Clerk's membership." },
    ],
  },
  {
    label: "AI & retrieval",
    tools: [
      { name: "Anthropic Claude (Haiku 4.5)", use: "The model behind every answer. It runs an agentic loop: reads the docs and live chain state through tools, then answers and cites what it used." },
      { name: "Groq (Llama 3.3 70B)", use: "A fallback model with the same tool interface. If Anthropic is slow or unavailable, answers keep flowing rather than failing." },
      { name: "Voyage AI / Cohere", use: "Turns each customer's documentation into embeddings, so the assistant searches their docs by meaning rather than keywords." },
    ],
  },
  {
    label: "Blockchain data",
    tools: [
      { name: "Moralis", use: "Wallet balances, token holdings and transaction history across the major EVM chains." },
      { name: "Etherscan V2 + Blockscout", use: "Contract verification and ABIs, plus a fallback wallet reader for EVM chains Moralis does not index, such as Etherlink." },
      { name: "Helius", use: "Solana RPC and enriched transaction history. The Solana path is built and paused in the interface." },
      { name: "Aptos fullnode + Indexer", use: "Move-native reads for Aptos: balances, transactions, on-chain module ABIs, and the Decibel perpetuals adapter." },
      { name: "Chainalysis (on-chain oracle)", use: "OFAC sanctions screening. Read on request and cited, never presented as proactive interception." },
      { name: "KyberSwap", use: "The swap aggregator behind the optional Actions feature. Transactions are user-signed; we never hold funds and take no fee." },
    ],
  },
  {
    label: "Payments & operations",
    tools: [
      { name: "Stripe", use: "Billing: checkout, the customer portal, and the webhook that is the single source of truth for a paid plan." },
      { name: "Upstash (Redis)", use: "Distributed rate limiting across serverless instances, with an in-memory fallback when it is not configured." },
      { name: "Cloudflare Turnstile", use: "Invisible bot detection on the public demo and the transaction checker." },
      { name: "GitHub Actions", use: "Scheduled jobs: documentation re-crawls and escalation retries, authenticated by a shared secret." },
      { name: "Resend", use: "Transactional email, where it is configured." },
      { name: "Telegram Bot API", use: "The same assistant delivered as a per-protocol Telegram bot, sharing the docs and persona but without wallet tools." },
    ],
  },
]

export default async function TechStackPage() {
  const email = await currentUserEmail()
  if (!isAdminEmail(email)) return notFound()

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-10">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Internal - do not share</p>
        <h1 className="text-3xl font-bold">Tech stack</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          What TxID runs on, and how each piece is used. The top half is the quick version for a demo.
          The bottom half is the deeper structure for a CTO who wants to grill you.
        </p>
        <div className="mt-3">
          <Link href="/admin" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-indigo-500/40 hover:text-indigo-400 transition-colors">
            ← Back to admin
          </Link>
        </div>
      </div>

      {/* At a glance */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">The stack at a glance</h2>
        {STACK.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 mb-3">{group.label}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.tools.map((t) => (
                <div key={t.name} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t.use}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* In depth */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">In depth, for CTO conversations</h2>
        <div className="space-y-6 max-w-3xl">
          <Deep title="Architecture in one line">
            <p>
              TxID is an intelligence layer that does three things: <strong>investigate</strong> (understand what happened
              on-chain before responding), <strong>resolve</strong> (answer the user, or escalate to your team with the full
              context attached), and <strong>record</strong> (keep a reproducible case history of every answer). The same
              engine is delivered on three surfaces: an embeddable website widget, a Telegram bot, and an API.
            </p>
          </Deep>

          <Deep title="The answer pipeline (retrieval + agentic tools)">
            <p>
              A question runs a retrieval step over the customer&apos;s documentation, stored as pgvector embeddings in Postgres,
              and then an agentic tool-use loop on Claude, up to five rounds. The model calls roughly two dozen tools to read
              live on-chain state (wallet balances, transactions, the decoded reason a transaction failed, contract state,
              token safety, sanctions screening) and returns an answer that cites what it read. Answers stream token by token.
              If Anthropic is unavailable, the same loop runs on Groq with the same tool interface, so a model outage degrades
              latency rather than breaking support.
            </p>
          </Deep>

          <Deep title="Grounding and anti-hallucination">
            <p>
              Grounding is <strong>computed, never self-reported</strong>: each answer is classed as verified (a live read
              succeeded), documented (retrieval matched but no chain read), or ungrounded. Every significant figure in an
              answer is traced back to a tool result or a documentation excerpt; any number that cannot be traced gets a
              caveat appended in the same turn. Because we stream, nothing here suppresses an answer, it flags the one answer
              with nothing behind it so it never looks identical to the verified ones. The class of error that would actually
              hurt a protocol, a confident wrong number about a user&apos;s own position, is the one made mechanically checkable.
            </p>
          </Deep>

          <Deep title="The case record and data integrity">
            <p>
              Every answer stores the conditions it was produced under: the ledger version it was true as of (so the chain
              state can be replayed), the prices any figure rested on, which lookups ran and which failed, the request context,
              the model, and a SHA-256 of the answer. Integrity is enforced in Postgres, not the application: message content
              and evidence are append-only, deletion is refused unless erasure is explicitly requested, and an erasure leaves a
              tombstone naming who did it and when. Views, exports and erasures are themselves logged. No IP address is kept in
              the record; only country-level location is ever stored, while infrastructure providers process IPs under their
              own retention policies.
            </p>
          </Deep>

          <Deep title="Multi-chain coverage">
            <p>
              EVM chains run through Moralis, with Etherscan and Blockscout for verification, ABIs and non-indexed chains.
              Solana runs on Helius, and Aptos is Move-native through its fullnode and Indexer, including a protocol adapter
              that reads a trader&apos;s Decibel subaccount correctly. Each chain family lives in its own shared package and the AI
              tools branch per family, so a new chain is added in one place. Failed transactions are diagnosed by replaying the
              revert (out-of-gas, then a plain revert reason, then a Solidity custom error or panic, then a signature lookup)
              and translating the result into plain English with the exact fix.
            </p>
          </Deep>

          <Deep title="Trust, safety and tenancy">
            <p>
              Clerk owns membership; we own permission, expressed as four capability-based roles (Admin, Developer, Support,
              Auditor) enforced on every server action, which is a public endpoint that anyone signed in could call directly.
              Every action verifies the organisation owns the project before any database read. Publishable keys are origin-
              guarded and integration secrets are server-only, never returned to the browser. Tool output and on-chain text are
              treated as data, not instructions, with the chain treated as hostile input. A no-financial-advice rule is
              unconditional and lives in the universal prompt, so it reaches every surface and cannot be switched off.
            </p>
          </Deep>

          <Deep title="Reliability and cost control">
            <p>
              Token usage is recorded per turn, including the prompt-cache buckets, and a daily spend circuit breaker reads
              those so a high-volume caller reading a cached prefix cannot register as almost-free. Escalations that fail to
              reach their destination are retried with backoff rather than lost. A schema check surfaces any database migration
              that has not yet been applied to production, because a missing table otherwise looks like a feature quietly doing
              nothing. Deploys go out from a protected branch behind a required test suite.
            </p>
          </Deep>
        </div>
      </section>
    </div>
  )
}

function Deep({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground [&_strong]:font-medium">
        {children}
      </div>
    </div>
  )
}
