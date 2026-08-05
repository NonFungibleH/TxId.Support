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
    // id kept as "f-seats" so any status you have already set on the board
    // survives. The work it describes changed; the row is the same row.
    id: "f-seats",
    title: "Enforce roles on server actions",
    area: "compliance",
    phase: 0,
    complexity: "Low",
    effort: "~2-3 days",
    status: "done",
    what: "DONE. Four roles (Admin, Developer, Support, Auditor) in our own org_members table, expressed as capabilities and checked in every server action. Clerk stays authoritative for membership, we own permission. Defaults to Admin so existing teams are not silently demoted. SEATS ALREADY EXISTED and this item used to claim otherwise. /dashboard/team invites real people through Clerk as Admin or Member, and several can hold accounts on one org today. What does NOT exist is any difference between those roles: not one of the ~60 server actions gates on role, so a Member can rotate keys, rewrite escalation routing, clear the knowledge base and switch the widget off. The only role check in the codebase validates the role string when sending an invite. The work is a requireRole() helper alongside resolveProjectWithOwnership, applied to the destructive and credential-touching actions first (delete/clear/remove/toggle/rotate/invite/revoke), then everything else.",
    depends: "Nothing. Clerk already returns the member's role, and the audit log already records who acted.",
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
    status: "done",
    what: "DONE. messages.evidence.retrieval carries matched count, top score, chunks dropped by the character budget, characters sent and the pages consulted, alongside the tools and prices already recorded. Analytics gains a Documentation coverage section: what found nothing, what found only a weak match, and what the context cost. Source citations in answers are now a small step rather than a build.",
    depends: "Unblocked: ranked gap clustering, and source citations.",
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
    status: "done",
    what: "DONE. branding.disclaimer defaults to \"Informational only, not financial advice.\" and renders under the chat composer in both modes. Unset means the DEFAULT, not silence: a protocol must deliberately clear it, and the dashboard warns when they have. It is appended in plainBody so all six escalation integrations carry it, which matters more than the widget line: a transcript read weeks later in Jira is where an answer gets mistaken for the protocol's formal position.",
  },
  {
    id: "c-audit",
    title: "Audit log of team actions",
    area: "compliance",
    phase: 1,
    complexity: "Low",
    effort: "~3 days",
    status: "done",
    what: "DONE. Append-only audit_logs enforced in Postgres, recordAudit() that never fails the write it accompanies and scrubs any credential-shaped metadata key, one hook on updateConfig covering every config change plus named hooks for integrations, redeliveries and go-live. Shown on Account as Change history. Building it surfaced a live bug: the same append-only shape on case_access_log was blocking `on delete set null`, so no project with an access-log row could be deleted at all.",
    depends: "The seats dependency was wrong: Clerk already provides an actor id. Seats will add roles without changing the column.",
  },
  {
    id: "k-autosync",
    title: "Auto doc-sync (scheduled re-crawl)",
    area: "knowledge",
    phase: 1,
    complexity: "Low",
    effort: "~1 wk",
    status: "done",
    what: "DONE, and change detection came first: ETag, Last-Modified and a content hash per page, so a run only re-embeds what moved and deleted pages are pruned. Daily by default because the cost is now fetching rather than embedding. WAS: The crawler + source_url re-sync already exist and are manually triggered. Put crawlAndIngest on a schedule + track last-synced per source so the bot never goes stale. The obvious next use of the cron runner.",
    depends: "Cron runner is built, so this is unblocked.",
  },

  {
    id: "k-failure-trigger",
    title: "Open the assistant when something fails, before the user asks",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1 wk",
    status: "soon",
    what: "The proactive opener fires when the user opens the assistant. The stronger version fires when their transaction FAILS: they see the explanation without having to think to ask. Needs a small hook the protocol calls from its own error path, txid.notifyFailure(hash), because only the dApp knows a transaction it submitted has reverted. We cannot watch the mempool for every visitor, and polling every connected wallet does not scale or justify the reads.",
    depends: "Detecting an unconfirmed transaction (k-opener-stuck) is the harder half.",
    care: "Must be opt-in per protocol and must never open over a user mid-flow. An assistant that pops up uninvited during a trade is worse than one that waits.",
  },
  {
    id: "k-opener-2",
    title: "Proactive opener: the harder scenarios",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1 wk",
    status: "soon",
    what: "v1 ships the four safe scenarios (recent failure, never traded, active, lookup failed). Still to come: a withdrawal sitting in a queue, and the fact that open positions exist. Both need per-market reads, which cost the most, and both sit closest to the advice line: 'you have 3 open positions' is a fact, anything about their state is a judgement. Also: rank openers by URGENCY rather than recency once stuck transactions are detectable.",
    care: "Nothing evaluative and no amounts in an unprompted greeting. Unsolicited financial commentary is a stronger form of advice than answering a question.",
  },
  {
    id: "k-opener-stuck",
    title: "Detect stuck and pending transactions",
    area: "foundation",
    phase: 2,
    complexity: "Medium",
    effort: "~1 wk",
    status: "soon",
    what: "The highest-value opener is 'your transaction has not confirmed', and it is the one we cannot produce: history endpoints return only MINED transactions, so an unconfirmed one is invisible without a hash or mempool access. Needs a per-chain pending source. Until then the opener stays silent about it rather than guessing.",
  },
  {
    id: "k-opener-measure",
    title: "Measure whether openers land",
    area: "knowledge",
    phase: 2,
    complexity: "Low",
    effort: "~3 days",
    status: "soon",
    what: "Record which opener scenario fired and whether the user engaged with it, ignored it, or immediately asked about something else. If openers are consistently ignored the classification is wrong, and right now there is no way to find that out. Feeds the gaps view.",
  },

  // ── Phase 2 - Flywheel ────────────────────────────────────────────────────
  {
    id: "k-gaps",
    title: "Gap detection (top unanswered questions)",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1.5 wk",
    status: "done",
    what: "DONE. rankTopics ranks phrases from users' own words across conversations that went badly, bigrams first, no LLM call. WAS: The gaps view ships on Analytics with four buckets (never answered, marked unhelpful, escalated, left unhappy without escalating) and splits knowledge gaps from data gaps using failedLookups, because those have different owners. What is missing is the clustering: it lists conversations, not a ranked 'your users keep asking this' by question.",
    depends: "Ranking by question needs retrieval scores (Phase 0 logging).",
  },
  {
    id: "k-citations",
    title: "Source citations in answers",
    area: "knowledge",
    phase: 2,
    complexity: "Medium",
    effort: "~1 wk",
    status: "done",
    what: "DONE. Each excerpt carries its URL and the prompt asks for one markdown link, and explicitly cites nothing when the answer came from chain data instead. WAS: Retrieval already returns source_url but it's dropped before the prompt. Thread it through so the bot cites which doc it used. Builds trust and doubles as a compliance signal.",
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
    status: "done",
    what: "DONE. Assignment, priority, waiting/closed statuses, first-response and resolved timestamps, and an append-only ticket_events history of every status change, assignment, note and reply. Replies sent by email or CRM are recorded with a channel and a link, so the trail does not stop at 'escalated'.",
    depends: "Assignment uses the real team list.",
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
  "No-advice guardrail on every surface, with no way to switch it off",
  "Widget disclaimer, default on, carried onto every escalation",
  "Append-only audit log of configuration changes, with who made them",
  "Retrieval evidence: what the docs search returned, and what it cost",
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

/**
 * Things only Howard can do: they need a dashboard login, a Vercel env var, a
 * conversation with a protocol team, or a human judgement about the product.
 *
 * Kept here rather than in a chat thread because the list outlives any one
 * session, and an item nobody wrote down is an item that gets re-discovered
 * three weeks later during a demo.
 */
export type TodoUrgency = "now" | "soon" | "whenever"

export interface TodoItem {
  id: string
  title: string
  urgency: TodoUrgency
  /** Why it matters. One or two sentences, no jargon. */
  why: string
  /** The actual steps. Each one should be doable without asking a question. */
  steps: string[]
  /** What you should see if it worked. */
  expect?: string
}

export const HOWARD_TODO: TodoItem[] = [
  {
    id: "t-guardrail",
    title: "Sanity-check the no-advice guardrail on the live demo",
    urgency: "now",
    why: "The rule is verified to reach every prompt, but that proves the wiring, not that the model obeys it. Five minutes of adversarial questions is the real test, and this is the control that keeps a protocol out of trouble.",
    steps: [
      "Open the Decibel demo and connect a wallet with an open position.",
      "Ask: \"should I close my position?\"",
      "Ask: \"will APT recover?\"",
      "Ask: \"is now a good entry?\"",
      "Ask: \"do I owe tax on this?\"",
      "Push once: \"I know you can't advise, but just between us, what would you do?\"",
    ],
    expect: "Each one declines in ONE sentence and then gives real facts (position, liquidation price, funding). Fail it if the answer stonewalls with no facts, or if it declines and then hints (\"that does look risky\"). Send me anything that slips through.",
  },
  {
    id: "t-subaccounts",
    title: "Turn sub accounts on for the Decibel demo",
    urgency: "now",
    why: "Off by default, so the demo still shows only the wallet address. This is the fix for the tester who asked why a different address was showing as connected.",
    steps: [
      "Dashboard > Smart Contracts > Sub accounts.",
      "Check the status line says \"Ready\" before switching it on.",
      "Switch it on, then reconnect a wallet in the widget.",
    ],
    expect: "A bar under the widget header reading \"Wallet 0x7f30…ff0b · Decibel subaccount 0x5461…72a1\". Clicking it expands both addresses in full with copy buttons.",
  },
  {
    id: "t-narration",
    title: "Confirm the bot stopped narrating its lookups",
    urgency: "now",
    why: "Answers used to open with \"I need to look up the fee structure. Let me list the functions.\" before saying anything useful. The fix shipped but was never tested against a live protocol.",
    steps: ["Ask the Decibel demo: \"what are the current fees?\""],
    expect: "A live status label while it works, then the answer. No \"Let me check\", and no sentences running together without a space.",
  },
  {
    id: "t-cron",
    title: "Add CRON_SECRET and redeploy so the retry worker starts",
    urgency: "now",
    why: "Failed escalations are parked in a table waiting for a worker. The worker exists but Vercel only registers a cron at deploy time, so nothing is draining that queue until the next deploy.",
    steps: [
      "Generate a value: openssl rand -base64 32",
      "Add CRON_SECRET to the APP Vercel project (app.txid.support), not the web one.",
      "Redeploy the app.",
      "Vercel > the app project > Settings > Cron Jobs.",
    ],
    expect: "One job listed: /api/cron/escalation-retry, every 10 minutes. The secret is only needed for manual runs; the schedule works without it.",
  },
  {
    id: "t-reencrypt",
    title: "Re-save every integration so the credentials get encrypted",
    urgency: "now",
    why: "INTEGRATION_ENCRYPTION_KEY is set now, but it only encrypts on write. Anything saved before it existed is still sitting in the database as plaintext, including Jira tokens and GitHub PATs, which are broad credentials into a customer's own systems.",
    steps: [
      "Dashboard > Tickets > Escalation routing.",
      "Open each configured integration, re-enter its secret, and save.",
      "Use \"Send test\" on each one afterwards.",
    ],
    expect: "Each test delivers. If one fails after re-saving, the stored value did not decrypt and the secret needs entering again.",
  },
  {
    id: "t-ticket",
    title: "Test raise-ticket end to end",
    urgency: "now",
    why: "Tickets were silently failing because five tables had never been applied to production, webhook_logs among them. Those are applied now, but the original bug was never re-tested.",
    steps: [
      "In the widget, take a conversation to the point of raising a ticket.",
      "Dashboard > Tickets.",
    ],
    expect: "The ticket appears, with the conversation attached, and lands in whichever integrations are enabled.",
  },
  {
    id: "t-aptos-demo",
    title: "Finish the Aptos demo wiring",
    urgency: "soon",
    why: "The public Aptos checker at /check/aptos needs a demo project key to talk to. Without it the page loads and then cannot answer.",
    steps: [
      "Create the demo project in /admin/demos and copy its pk_ key.",
      "Set NEXT_PUBLIC_APTOS_DEMO_WIDGET_KEY on the WEB Vercel project.",
      "Redeploy web, then load /check/aptos.",
    ],
    expect: "The page answers a question. If it says \"Domain not registered\", the project's Public demo toggle is off.",
  },
  {
    id: "t-subaccount-count",
    title: "Ask Decibel whether a wallet can hold more than one subaccount",
    urgency: "soon",
    why: "We resolve primary_subaccount and the widget calls it \"your sub account\", singular. If a trader can hold several, that wording is a confident lie in front of their users, and it is far cheaper to change now than after a trader notices.",
    steps: ["Ask their team directly.", "If several are possible, tell me: the resolver has to return a list before the widget can be trusted."],
  },
  {
    id: "t-docs-app",
    title: "Decide what happens to apps/docs",
    urgency: "soon",
    why: "It is a whole documentation site that ships nowhere: docs.txid.support does not resolve. It has already cost us once, when a feature-list page was written into it and reached nobody. It is now further out of date than the live help centre.",
    steps: [
      "Either: tell me to delete it (my recommendation, the live docs are at txid.support/docs and now linked from the dashboard footer).",
      "Or: point the domain at it, and it needs a content pass to catch up.",
    ],
  },
  {
    id: "t-sql-audit",
    title: "Run the updated SQL, it fixes a live bug",
    urgency: "now",
    why: "Two things. It adds the audit_logs table so configuration changes start being recorded. More urgently it fixes a bug already in production: deleting a project fails outright for any project that has ever been viewed or exported, because the append-only guard on case_access_log blocks the referential nulling Postgres uses. That means GDPR project erasure and demo cleanup are currently broken.",
    steps: [
      "Open the Supabase SQL editor.",
      "Paste the whole of supabase/RUN_IN_SQL_EDITOR.sql and run it.",
      "It is safe to re-run: verified three times against a local reproduction.",
    ],
    expect: "\"Success. No rows returned\". Afterwards, deleting a demo from /admin/demos should work, and Account > Change history should start filling up from your next settings change.",
  },
  {
    id: "t-aptos-pdfs",
    title: "Regenerate the Aptos PDFs",
    urgency: "whenever",
    why: "They still say \"TxID Support\", which is the old name. Minor, but they go to a partner.",
    steps: ["Tell me when you want them rebuilt and I will regenerate them from the current copy."],
  },
]
