/**
 * The whole system, as data.
 *
 * WHY DATA AND NOT A DRAWING: a diagram in Figma is out of date the week after
 * it is made and nobody notices. This sits next to the code, so when a layer
 * changes the page changes with it, and anything stale is a diff rather than a
 * discovery in front of a partner.
 *
 * STATUS IS THE POINT. Every node says whether it exists, which is the same
 * honesty the product applies to its own answers. A capability with no status
 * cannot be added.
 */

export type NodeStatus =
  /** In production today. */
  | "live"
  /** Built, but off unless a protocol turns it on. */
  | "optional"
  /** Aptos-specific, and Move-native rather than another EVM entry. */
  | "aptos"
  /** Not built. Says so. */
  | "planned"
  /** Built and deliberately hidden. */
  | "paused"

export interface StackNode {
  name: string
  detail: string
  status: NodeStatus
  /** Where it lives, so the page is a map to the code and not just a picture. */
  where?: string
}

export interface StackLayer {
  id: string
  title: string
  /** What this layer is FOR, in one sentence. */
  purpose: string
  nodes: StackNode[]
}

export const STATUS_LABEL: Record<NodeStatus, string> = {
  live: "Live",
  optional: "Opt-in",
  aptos: "Aptos",
  planned: "Not built",
  paused: "Paused",
}

/** Ordered: a question enters at the top and leaves as a record at the bottom. */
export const STACK: StackLayer[] = [
  {
    id: "surfaces",
    title: "Where a user meets it",
    purpose: "One assistant, several front doors. All of them land on the same pipeline.",
    nodes: [
      { name: "Embedded widget", detail: "One script tag on the protocol's own site.", status: "live", where: "apps/app/app/widget" },
      { name: "Inline embed", detail: "Rendered in a container rather than a floating button.", status: "live" },
      { name: "React package", detail: "@txid/react for direct integration.", status: "live", where: "packages/react" },
      { name: "Telegram bot", detail: "One bot per protocol. Same knowledge, no wallet tools.", status: "live", where: "app/api/telegram/[key]" },
      { name: "REST API", detail: "Server to server, secret-key auth.", status: "live", where: "app/api/v1/diagnose" },
      { name: "MCP server", detail: "Diagnostics as tools for AI clients.", status: "planned" },
    ],
  },
  {
    id: "ingress",
    title: "Before anything runs",
    purpose: "Three cheap checks that stop abuse and runaway cost before a model is ever called.",
    nodes: [
      { name: "Domain allowlist", detail: "A key only works on the origins the protocol registered.", status: "live" },
      { name: "Rate limit", detail: "Per IP and per key. Upstash when set, per-instance otherwise.", status: "live", where: "lib/rate-limit.ts" },
      { name: "Turnstile", detail: "Invisible bot check on public surfaces.", status: "live" },
      { name: "Plan quota", detail: "Conversations per month, enforced server-side.", status: "live", where: "lib/limits.ts" },
    ],
  },
  {
    id: "context",
    title: "What the model is told, before it is asked",
    purpose: "Assembled per question. This is where accuracy is mostly won or lost.",
    nodes: [
      { name: "Service update", detail: "The protocol's own notice. Placed FIRST and outranks the documentation, because the docs describe normal operation.", status: "optional", where: "lib/types/config.ts" },
      { name: "Documentation (RAG)", detail: "pgvector search over the protocol's own pages. Each excerpt carries its source URL.", status: "live", where: "packages/ai/src/rag.ts" },
      { name: "Watched contracts", detail: "Addresses, ABIs and the per-contract error glossary.", status: "live" },
      { name: "Move error maps", detail: "Abort codes to plain English for Decibel, PancakeSwap, Amnis, Thala, Aries.", status: "aptos", where: "packages/aptos/src/errmap.ts" },
      { name: "Sub account", detail: "Resolves the account object holding the user's positions, so both addresses are known up front.", status: "optional", where: "lib/protocol-account.ts" },
      { name: "No financial advice", detail: "Unconditional. Not switchable by any protocol.", status: "live", where: "packages/ai/src/prompt.ts" },
      { name: "Proactive opener", detail: "On connect, leads with what is actually happening rather than a blank prompt.", status: "live", where: "lib/session-opener.ts" },
    ],
  },
  {
    id: "intelligence",
    title: "The investigation",
    purpose: "An agentic loop, up to five rounds. The model chooses what to read; the reads are real.",
    nodes: [
      { name: "Claude tool loop", detail: "~24 tools. Text written before a tool call is dropped, so the user sees a status line rather than thinking aloud.", status: "live", where: "packages/ai/src/stream.ts" },
      { name: "EVM reads", detail: "8 chains. Moralis, block explorers, and eth_call replay for failed transactions.", status: "live", where: "packages/blockchain" },
      { name: "Aptos reads", detail: "Fullnode REST and Indexer GraphQL. Move aborts, module ABIs, view functions, .apt names.", status: "aptos", where: "packages/aptos" },
      { name: "Protocol adapters", detail: "Positions, liquidation risk, funding, withdrawal queues. Size decimals read PER MARKET, never assumed.", status: "aptos", where: "packages/aptos/src/protocols.ts" },
      { name: "Solana", detail: "Built end to end, hidden in the interface.", status: "paused", where: "packages/solana" },
      { name: "Actions", detail: "User-signed only: TxID never holds keys or signs. Model proposes, policy gate decides, user signs. Allowlist set by the protocol admin, arguments static and non-payable, per-swap USD cap, fail-closed OFAC screen per invocation, geo gate, full re-gate with a fresh quote before signing.", status: "optional", where: "packages/ai/src/actions.ts" },
    ],
  },
  {
    id: "verification",
    title: "Checking the answer before it stands",
    purpose: "The output is checked against what was read, rather than the model being trusted. Note the limit precisely: this establishes that a figure was SOURCED, not that a claim is TRUE. A perfectly traced number can still support a wrong claim. Claim-level verification is on the roadmap, not built.",
    nodes: [
      { name: "Numeric sourcing", detail: "Every figure must trace to a tool result or a retrieved excerpt. Establishes PROVENANCE, not correctness: a number can be correctly sourced and still support a wrong claim.", status: "live", where: "lib/numeric-check.ts" },
      { name: "Grounding", detail: "Verified, documented or ungrounded. COMPUTED from what happened, never asked of the model.", status: "live", where: "app/api/chat/route.ts" },
      { name: "Caveat on the answer", detail: "We stream, so nothing can be retracted. An unfounded answer is qualified in the same turn instead.", status: "live" },
      { name: "Advice classifier", detail: "Today the rule is a prompt instruction, so \"the safest option is...\" can pass without using advice vocabulary. Catching advice-shaped OUTPUT would make it enforcement.", status: "planned" },
      { name: "Claim-level verification", detail: "Evidence attaches to the ANSWER, not each claim in it. Fact and inference are not distinguished: \"it reverted\" and \"it reverted BECAUSE of X\" carry equal weight.", status: "planned" },
    ],
  },
  {
    id: "isolation",
    title: "Keeping tenants and untrusted text apart",
    purpose: "Two separations the product rests on, previously absent from this page, which is why an external auditor read them as missing entirely.",
    nodes: [
      { name: "Instructions vs data", detail: "Token names, revert strings, event params and memos are DATA written by arbitrary third parties. Text inside them asking for an action is ignored, and flagged to the user as a likely scam.", status: "live", where: "packages/ai/src/prompt.ts" },
      { name: "No relayed links", detail: "Links and contact details found in chain data are never passed on. Only the protocol's own configured links.", status: "live" },
      { name: "Identity by address", detail: "Tokens are identified by address, never a self-reported symbol, so a contract calling itself USDC is never confirmed as USDC.", status: "live" },
      { name: "Instruction confidentiality", detail: "The prompt is never revealed or discussed, whoever the user claims to be. Identity cannot be verified in a chat, so everyone is an end user.", status: "live" },
      { name: "Documentation trust", detail: "Retrieved docs are still described to the model as authoritative. A compromised documentation site is therefore a weaker boundary than on-chain text, which is treated as hostile. Worth hardening.", status: "planned" },
      { name: "Tenant scoping", detail: "Every server action resolves org ownership before any read or write. Retrieval, integrations, exports and tickets are all project-scoped.", status: "live" },
      { name: "Database-level tenancy", detail: "Application code is currently the ONLY tenancy boundary: 43 files use the service-role key. RLS policies scoped by org would add a backstop.", status: "planned" },
    ],
  },
  {
    id: "record",
    title: "The record",
    purpose: "What makes an answer checkable months later. The part institutional buyers think they are buying.",
    nodes: [
      { name: "Named sources", detail: "Every document, contract, transaction, price and position the answer rested on, listed individually.", status: "live", where: "packages/ai/src/evidence.ts" },
      { name: "Documentation version", detail: "The content hash of the page as it stood, so the exact text is identifiable later.", status: "live" },
      { name: "Transaction provenance", detail: "Hashes recorded and marked: pasted by the user, or found by us. Different claims.", status: "live" },
      { name: "Chain state", detail: "The ledger version or block the answer was true as of, so it can be replayed.", status: "live", where: "lib/evidence.ts" },
      { name: "Prices at read", detail: "The figures a number rested on, without which it is unverifiable.", status: "live" },
      { name: "Request context", detail: "Country, coarse device, surface, language. No IP is persisted in APPLICATION records. The rate limiter keys on one for the window duration, and Vercel, Clerk and Turnstile process them under their own retention.", status: "live" },
      { name: "Append-only", detail: "Enforced by Postgres triggers, not application code.", status: "live", where: "supabase/migrations/20260803000002" },
      { name: "Access log", detail: "Who viewed, exported or erased a record. Itself append-only.", status: "live" },
      { name: "Export", detail: "Carries the evidence and logs itself as a disclosure.", status: "live" },
      { name: "Retention enforcement", detail: "Erasure exists; a scheduled purge and per-project period do not.", status: "planned" },
    ],
  },
  {
    id: "human",
    title: "When a person takes over",
    purpose: "The trail must not stop at the handover, which is where most support tooling loses it.",
    nodes: [
      { name: "Escalation", detail: "Ticket raised with the whole investigation attached.", status: "live" },
      { name: "Integrations", detail: "Slack, Discord, Telegram, Linear, GitHub, Jira. Issue URL written back.", status: "optional", where: "lib/integrations/escalation.ts" },
      { name: "Retry worker", detail: "A failed delivery is retried on a backoff, then marked abandoned rather than lost.", status: "live", where: "app/api/cron/escalation-retry" },
      { name: "Ticket inbox", detail: "Assignment, priority, waiting and closed states, first-response and resolution times.", status: "live" },
      { name: "Why it reached you", detail: "Computed from the evidence: a documentation gap, a failed read, an answer with no source.", status: "live", where: "lib/ticket-signals.ts" },
      { name: "Logged replies", detail: "A reply sent by email or CRM is recorded with a channel and a link, so the trail stays continuous.", status: "live" },
      { name: "Inbound email", detail: "Parsing replies onto the ticket automatically. Recorded by hand today.", status: "planned" },
    ],
  },
  {
    id: "governance",
    title: "Who can do what, and who did",
    purpose: "The answer to the question a security review asks straight after the case record.",
    nodes: [
      { name: "Four roles", detail: "Admin, Developer, Support, Auditor. Enforced in every server action, not hidden in the interface.", status: "live", where: "lib/roles.ts" },
      { name: "Auditor role", detail: "Reads and exports the full record and can change nothing. The account to hand an external auditor.", status: "live" },
      { name: "Change history", detail: "Who altered which setting, append-only, never storing a credential value.", status: "live", where: "lib/audit.ts" },
      { name: "Credential encryption", detail: "AES-256-GCM on integration secrets in the config.", status: "live", where: "lib/secrets.ts" },
      { name: "SSO", detail: "Not built.", status: "planned" },
      { name: "SOC 2", detail: "Not held.", status: "planned" },
    ],
  },
  {
    id: "insight",
    title: "What the protocol learns back",
    purpose: "Every conversation is product intelligence, not just a resolved ticket.",
    nodes: [
      { name: "Summaries and tags", detail: "One line, a category and sentiment per conversation. Advice requests labelled.", status: "live", where: "lib/actions/summarize.ts" },
      { name: "Gaps view", detail: "Never answered, marked unhelpful, escalated, left unhappy quietly, and answered without a source.", status: "live", where: "lib/gaps.ts" },
      { name: "Knowledge vs data gaps", detail: "Missing documentation and failed reads have different owners, so they are separated.", status: "live" },
      { name: "Documentation coverage", detail: "What the docs did not cover, covered weakly, and what the context cost.", status: "live" },
      { name: "What they keep asking", detail: "Ranked from users' own words. The write-this-next list.", status: "live", where: "lib/topics.ts" },
      { name: "Source filter", detail: "Widget, Telegram and preview separated, since they are not the same product.", status: "live" },
    ],
  },
]

/**
 * How far along a capability actually is.
 *
 * The auditor's most useful single suggestion: "built" and "proven" were doing
 * the same job on this page, and an institutional reader hears the second when
 * you say the first. Naming the rungs stops the page implying operational
 * evidence it does not have.
 */
export const MATURITY: { stage: string; meaning: string; where: string }[] = [
  { stage: "Built", meaning: "The code exists, typechecks and builds.", where: "Most of what shipped this week." },
  { stage: "Verified", meaning: "Its logic is exercised against realistic inputs.", where: "Roles, numeric sourcing, ticket signals, the migrations." },
  { stage: "Live", meaning: "Running against real protocol traffic.", where: "The chat pipeline, decoders, escalations. NOT the newest work." },
  { stage: "Proven", meaning: "Accuracy and reliability demonstrated over meaningful volume.", where: "Nothing yet. This needs the evaluation corpus and a real deployment." },
]

export interface ScheduledJob {
  path: string
  cadence: string
  what: string
}

export const SCHEDULED: ScheduledJob[] = [
  {
    path: "/api/cron/escalation-retry",
    cadence: "every 10 min",
    what: "Redelivers escalations that never arrived. Backs off 1m to 6h, then marks abandoned rather than deleting, because a user was promised a human.",
  },
  {
    path: "/api/cron/docs-resync",
    cadence: "daily 03:00",
    what: "Asks each documentation page whether it changed, re-embeds only those that did, and prunes pages that no longer exist.",
  },
  {
    path: "summarizeStaleConversations",
    cadence: "on dashboard load",
    what: "Summary, category and sentiment per conversation, generated lazily rather than on a schedule.",
  },
]

/** Things a buyer would reasonably assume exist, and would be wrong. */
export const HONEST_GAPS: { title: string; detail: string }[] = [
  {
    title: "Two-way replies to the user",
    detail: "Widget users are anonymous and transient, so the realistic channel is email. Today a person replies from their own mailbox and records that they did. Automatic capture needs a receiving domain, a parser, threading and spoofing protection.",
  },
  {
    title: "Retention enforcement",
    detail: "Erasure, tombstones, the access log and export all exist. A scheduled purge and a configurable period do not, so the privacy policy describes what actually happens rather than promising a schedule nothing keeps.",
  },
  {
    title: "Stuck transactions",
    detail: "The most valuable opener would be 'your transaction has not confirmed', and it is the one we cannot produce: history endpoints return only mined transactions, so an unconfirmed one is invisible without a hash or mempool access.",
  },
  {
    title: "Nothing has run against live traffic yet",
    detail: "The most recent work typechecks, builds, and its logic is tested against realistic inputs. The proactive opener, service updates, provenance extraction and documentation auto-sync have not been exercised against a real protocol.",
  },
]
