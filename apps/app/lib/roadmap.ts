// Product roadmap data for the admin /roadmap board. Plain, serializable data
// so it can be passed from the server page into the client board. Edit this
// file to change the canonical plan; per-item status + notes overrides live in
// the admin's browser (localStorage) on top of these defaults.

export type RoadmapArea = "foundation" | "knowledge" | "handoff" | "compliance"
export type Complexity = "Low" | "Medium" | "High" | "Very High"
// Mirrors the board's own status list, so an item that has shipped can say so
// in the data rather than only in one admin's browser storage.
export type DefaultStatus = "next" | "in-progress" | "soon" | "later" | "done" | "deferred"

export interface RoadmapItem {
  id: string
  title: string
  area: RoadmapArea
  phase: 0 | 1 | 2 | 3 | 4
  complexity: Complexity
  effort: string
  status: DefaultStatus
  /** What it is + why it matters (1-2 sentences). */
  what: string
  /** Dependency / blocker, if any. */
  depends?: string
  /** Caution flag (e.g. needs a legal read). */
  care?: string
}

export const AREA_LABEL: Record<RoadmapArea, string> = {
  foundation: "Foundation",
  knowledge: "Knowledge loop",
  handoff: "Human handoff",
  compliance: "Compliance",
}

export const PHASES: { phase: 0 | 1 | 2 | 3 | 4; title: string; subtitle: string }[] = [
  { phase: 0, title: "Phase 0 · Foundations", subtitle: "Nothing ships to users, but each one unlocks several features below. Build first." },
  { phase: 1, title: "Phase 1 · Quick, high-value wins", subtitle: "Cheap to build, visible, low-risk. Where I'd start after foundations." },
  { phase: 2, title: "Phase 2 · The flywheel", subtitle: "'Gets smarter on its own' + a real inbox. Needs the foundations in place." },
  { phase: 3, title: "Phase 3 · Heavy, high-payoff", subtitle: "Bigger builds that deepen the moat and unlock regulated buyers." },
  { phase: 4, title: "Parking lot · Deferred / needs care", subtitle: "Not now: too heavy, or needs a legal read first." },
]

export const FRAMING = {
  vision:
    "Shift from a reactive support widget (problem → answer) to a trustworthy knowledge-and-records layer: prevent tickets, resolve them well when they happen, and turn every interaction into product intelligence.",
  constraint:
    "Guardrail: INFORM, don't advise. No regulated advice (no buy/sell, price predictions, tax, or legal). Reading the chain to diagnose a past transaction is fine, that's factual and read-only. Actions since shipped and narrow the rule rather than break it: TxID never holds keys or signs, only prepares a transaction the user explicitly asked for and signs in their own wallet, and is forbidden from proposing or recommending one.",
}

export const ROADMAP: RoadmapItem[] = [
  // ── Phase 0 - Foundations ─────────────────────────────────────────────────
  {
    id: "f-seats",
    title: "Team seats + roles",
    area: "foundation",
    phase: 0,
    complexity: "Medium",
    effort: "~1 wk",
    status: "next",
    what: "Today it's one user per org, no seats, no roles. Add an org_users join table (admin/agent/viewer). Clerk already supports org members; needs RLS role checks + an invite UI.",
    depends: "Blocks: handoff assignment, compliance audit + access control.",
  },
  {
    id: "f-cron",
    title: "Async job / cron runner",
    area: "foundation",
    phase: 0,
    complexity: "Low",
    effort: "~0.5 wk",
    status: "done",
    what: "DONE. apps/app/vercel.json runs /api/cron/escalation-retry every 10 minutes, authorised by Vercel's cron header or CRON_SECRET. Adding another scheduled job is now a route plus a line of config.",
    depends: "Unblocked: knowledge auto-sync, compliance retention purge.",
  },
  {
    id: "f-logging",
    title: "Per-message signal logging",
    area: "foundation",
    phase: 0,
    complexity: "Low",
    effort: "~0.5 wk",
    status: "next",
    what: "PART DONE. messages.evidence now persists which tools ran, which lookups failed, and the prices a figure rested on, which is what powers the knowledge-vs-data split. Retrieval is still the hole: chunk scores and source_url are computed then dropped, so 'the docs did not cover this' cannot yet be told apart from 'the docs covered it badly'.",
    depends: "Blocks: ranked gap clustering, and source citations.",
  },

  // ── Phase 1 - Quick wins ──────────────────────────────────────────────────
  {
    id: "c-noadvice",
    title: "No-advice guardrail (first-class + logged)",
    area: "compliance",
    phase: 1,
    complexity: "Low",
    effort: "~2 days",
    status: "done",
    what: "DONE. An unconditional policy block in buildUniversalRules, so it reaches support mode, token mode, the widget, Telegram and the API alike. Refuses buy/sell/hold/sizing, price predictions, good-investment judgements, tax and legal, and the same questions asked as an opinion or hypothetically, then hands over the facts instead. Deliberately NOT configurable: a protocol cannot switch off the rule that protects it. Conversations that asked for advice are labelled advice-request so the volume is visible.",
  },
  {
    id: "c-disclaimer",
    title: "Widget disclaimers",
    area: "compliance",
    phase: 1,
    complexity: "Low",
    effort: "~1 day",
    status: "next",
    what: "There is zero disclaimer text in the widget today. Add a BrandingConfig field ('informational only, not financial advice') and render it in the widget + on escalation.",
  },
  {
    id: "c-audit",
    title: "Audit log of team actions",
    area: "compliance",
    phase: 1,
    complexity: "Low",
    effort: "~3 days",
    status: "soon",
    what: "New audit_logs table + a log.audit() helper wired into server actions (config changes, key generation, ticket actions). Small build, big trust signal for serious buyers.",
    depends: "Best after seats (needs an actor id).",
  },
  {
    id: "k-autosync",
    title: "Auto doc-sync (scheduled re-crawl)",
    area: "knowledge",
    phase: 1,
    complexity: "Low",
    effort: "~1 wk",
    status: "soon",
    what: "The crawler + source_url re-sync already exist and are manually triggered. Put crawlAndIngest on a schedule + track last-synced per source so the bot never goes stale. The obvious next use of the cron runner.",
    depends: "Cron runner is built, so this is unblocked.",
  },

  // ── Phase 2 - Flywheel ────────────────────────────────────────────────────
  {
    id: "k-gaps",
    title: "Gap detection (top unanswered questions)",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1.5 wk",
    status: "in-progress",
    what: "PART DONE. The gaps view ships on Analytics with four buckets (never answered, marked unhelpful, escalated, left unhappy without escalating) and splits knowledge gaps from data gaps using failedLookups, because those have different owners. What is missing is the clustering: it lists conversations, not a ranked 'your users keep asking this' by question.",
    depends: "Ranking by question needs retrieval scores (Phase 0 logging).",
  },
  {
    id: "k-citations",
    title: "Source citations in answers",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1 wk",
    status: "later",
    what: "Retrieval already returns source_url but it's dropped before the prompt. Thread it through so the bot cites which doc it used. Builds trust and doubles as a compliance signal.",
  },
  {
    id: "k-curation",
    title: "Curation queue (approve snippets)",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1.5 wk",
    status: "later",
    what: "A review queue where the team approves/edits AI-suggested knowledge snippets and pins canonical answers. Human-gated 'gets smarter on its own' (also keeps content vetted for compliance).",
  },
  {
    id: "k-ticket2kb",
    title: "Ticket → knowledge snippet",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1 wk",
    status: "later",
    what: "When a human resolves an escalation, one click to save that answer as a snippet the bot uses next time. Where the knowledge loop and the inbox join.",
    depends: "Needs the handoff inbox.",
  },
  {
    id: "h-inbox",
    title: "Inbox: assignment + priority + tags + SLA",
    area: "handoff",
    phase: 2,
    complexity: "Low",
    effort: "~1 wk",
    status: "soon",
    what: "Tickets exist with status + notes. Add assignment, priority, tags and SLA timers (columns + UI). Turns the ticket list into a real inbox.",
    depends: "Needs team seats (to assign to).",
  },
  {
    id: "h-realtime",
    title: "Realtime inbox updates",
    area: "handoff",
    phase: 2,
    complexity: "Medium",
    effort: "~1 wk",
    status: "later",
    what: "@supabase/realtime-js is already a dependency. Subscribe the dashboard to the tickets table for live status + new-ticket alerts, plus the pre-worked diagnostic context on each ticket.",
  },

  // ── Phase 3 - Heavy, high-payoff ──────────────────────────────────────────
  {
    id: "h-twoway",
    title: "Two-way reply to the user (email round-trip)",
    area: "handoff",
    phase: 3,
    complexity: "High",
    effort: "~2-3 wk",
    status: "later",
    what: "THE crux of handoff. Widget users are transient/anonymous, so the realistic reply channel is email (they leave one at escalation): team replies → user gets an email → user replies → an inbound-email parser threads it back onto the ticket.",
    care: "Decide v1 = email round-trip (pragmatic) vs forcing users back into the widget (fragile).",
  },
  {
    id: "h-discord",
    title: "Discord bot",
    area: "handoff",
    phase: 3,
    complexity: "High",
    effort: "~2 wk",
    status: "later",
    what: "The obvious channel gap for DeFi (Telegram already exists as a proven pattern to mirror). Inbound questions + the ability to route escalations to a channel.",
  },
  {
    id: "c-retention",
    title: "Data retention enforcement + GDPR delete/export",
    area: "compliance",
    phase: 3,
    complexity: "Medium",
    effort: "~1.5-2 wk",
    status: "soon",
    what: "PART DONE. Erasure and export exist: erase_conversation() and admin_erase_project() leave tombstones, /api/conversations/export carries the evidence and logs itself as a disclosure, and case_access_log records every view, export and erasure. What is missing is the automatic side: there is no scheduled purge and retention is not configurable per project. The privacy policy no longer claims a 12-month period, since nothing enforced it; it now describes what actually happens, so this is a feature gap rather than a broken promise.",
    depends: "Cron runner is built, so the scheduled purge is unblocked.",
  },
  {
    id: "c-access",
    title: "Roles-gated access + SSO",
    area: "compliance",
    phase: 3,
    complexity: "High",
    effort: "~2 wk",
    status: "later",
    what: "Extend seats into full role-based dashboard access with an audit trail and (later) SSO. Part of the up-market/regulated story.",
    depends: "Extends team seats (Phase 0).",
  },

  // ── Phase 4 - Parking lot ─────────────────────────────────────────────────
  {
    id: "h-takeover",
    title: "Live 'takeover' / co-browse",
    area: "handoff",
    phase: 4,
    complexity: "Very High",
    effort: "months",
    status: "deferred",
    what: "Agent joins the user's live session / sees their screen. WebRTC or browser-extension territory with a consent model. Defer indefinitely.",
  },
  {
    id: "c-sanctions",
    title: "Sanctions: enforce + log (careful)",
    area: "compliance",
    phase: 4,
    complexity: "Low",
    effort: "~3 days",
    status: "deferred",
    what: "The Chainalysis OFAC screening tool already exists. Making it mandatory + logged is easy technically.",
    care: "Get a legal read first: the current prompt tells the bot to 'advise against interacting', which edges into the advice we want to avoid. Reframe to 'deflect + log + flag to the team', don't advise the user.",
  },
]

// A short record of what shipped recently, for context on the board.
export const SHIPPED: string[] = [
  "Aptos: Move-native diagnosis, abort decoding, Petra/Martian, .apt names",
  "Decibel protocol adapter: positions, liquidation risk, funding, withdrawals",
  "Sub accounts: both addresses shown on connect, labelled, in full",
  "The case record: chain state, prices, failed lookups and answer hash per answer",
  "Append-only records enforced in Postgres, with an access log and recorded erasure",
  "Case export carrying ledger version, country, model and answer hash",
  "Gaps view: never answered, unhelpful, escalated, silently unhappy, split by owner",
  "Escalation integrations: Slack, Discord, Telegram, Linear, GitHub, Jira",
  "Escalation retry worker, so a failed delivery is never silently lost",
  "Conversation summaries, categories and sentiment",
  "Actions: user-signed swaps and allowlisted contract calls, off by default",
  "Credential encryption (AES-256-GCM) for stored integration secrets",
  "Telegram bot with the full on-chain toolset",
  "Demo creator: per-prospect themed demos, bookmarklet and share page",
  "👍/👎 answer feedback + live Satisfaction metric",
  "One-tap 'switch network' when the wallet is on the wrong chain",
  "Live REST API: POST /api/v1/diagnose (secret-key auth)",
  "Per-chain landing pages + interactive demos (/chains)",
]
