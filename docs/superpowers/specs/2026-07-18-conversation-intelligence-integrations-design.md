# Conversation Intelligence + Team Integrations — Design

**Date:** 2026-07-18
**Status:** Draft for review

Two related features that turn TxID from "logs the team must read" into "an active feed the team acts on."

- **A. Conversation summaries + auto-tags** — every conversation gets a one-line AI summary and a category, so the Conversations page is scannable.
- **B. Escalation integrations** — when a ticket is raised, fan it out to where the team lives: Slack, Discord, Telegram (notifications) and Linear, GitHub Issues, Jira (tracked issues, with the created issue URL stored back on the ticket).

Both are pure read/summarize/notify — no compliance surface, no smart-contract interaction.

---

## Feature A: Conversation summaries + auto-tags

### Data
Migration adds to `conversations`:
- `summary text` — one-line AI summary (≤160 chars)
- `category text` — one of: `failed-tx | how-to | bug-report | feature-request | account | other`
- `sentiment text` — `positive | neutral | negative`
- `summarized_at timestamptz` — when last summarised
- `last_message_at timestamptz` — denormalised from messages, so "needs re-summary" is a cheap column compare (updated on message insert in both chat + telegram persist paths)

### Generation (trigger + cost control)
Lazy, client-triggered, capped — no cron needed:
- The Conversations page renders instantly with whatever summaries exist (cached on the row).
- On mount, `ConversationList` calls a server action `summarizeStaleConversations(limit=8)`: it selects the project's conversations where `summarized_at IS NULL OR last_message_at > summarized_at`, oldest-stale first, takes up to `limit`, loads each one's messages, runs ONE Haiku call per conversation returning `{summary, category, sentiment}` (strict JSON, enum-validated; fallback to `other/neutral` on parse failure), writes the row, and returns the updated rows for the client to merge.
- Cost is bounded per page load; over a few visits all conversations get summarised. A per-conversation "↻" re-summarise button covers on-demand refresh.
- Skip conversations with < 2 messages (nothing to summarise). Token usage from these calls is recorded to `token_usage` like every other AI turn (they appear in the cost cockpit).

### UI (`ConversationList`)
- Each row shows: category chip (coloured), one-line summary (falls back to first user message while unsummarised), sentiment dot, wallet + time. The transcript stays available on click.
- A category filter (All / failed-tx / bug-report / …) so the team can triage.
- Analytics page later reads `category` for a "what users ask about" breakdown (out of scope here; the column makes it trivial).

### Model
Reuse `completeChatWithUsage` (Haiku, cheap) with a tight summarisation system prompt. One call per conversation. No tools.

---

## Feature B: Escalation integrations

### Config (server-only secrets)
`ProjectConfig.integrations?` — an object of optional per-target configs. **These hold third-party API tokens and MUST never reach the client.** They live in `projects.config` JSONB (same as `telegramBotToken`), and the widget-config endpoint is whitelist-based, so they're excluded by default — the audit checklist item is simply "never add `integrations` to the widget-config whitelist."

```ts
interface Integrations {
  slack?:    { webhookUrl: string; enabled: boolean }        // incoming webhook URL
  discord?:  { webhookUrl: string; enabled: boolean }        // incoming webhook URL
  telegram?: { chatId: string; enabled: boolean }            // team channel; reuses the project's connected bot token
  linear?:   { apiKey: string; teamId: string; enabled: boolean }
  github?:   { token: string; repo: string; enabled: boolean }  // repo = "owner/name"
  jira?:     { domain: string; email: string; apiToken: string; projectKey: string; enabled: boolean }
}
```

### Two adapter classes
Each adapter is a small function `(ticket, cfg) => Promise<{ ok: boolean; url?: string; error?: string }>`:

- **Notifications** (Slack, Discord, Telegram): POST a formatted message (ref, summary, reason, user, wallet/tx if present, truncated transcript). Fire-and-forget; log result. No return URL.
  - Slack/Discord: POST to the incoming webhook URL (`{text}` / `{content}`).
  - Telegram: `sendMessage` via the project's existing bot token (from `config.telegramBotToken`) to the configured `chatId`. If no bot token connected, the Telegram integration can't be enabled (dashboard enforces).
- **Issue trackers** (Linear, GitHub, Jira): create an issue, return its URL.
  - Linear: GraphQL `issueCreate` (apiKey, teamId).
  - GitHub: `POST /repos/{owner}/{repo}/issues` (token).
  - Jira: `POST /rest/api/3/issue` (domain, basic auth email:apiToken, projectKey; ADF description body).
  - On success, the returned URL is stored back on the ticket (`tickets.external_refs jsonb` — `{linear?: url, github?: url, jira?: url}`) and shown in the dashboard Tickets list ("View in Linear ↗").

### Dispatch
`dispatchEscalation(supabase, project, ticket, integrations)` — called from the existing async block in `/api/tickets/route.ts` (right where the generic webhook + email already fire). Fans out to every enabled target with `Promise.allSettled` (one slow/broken integration never blocks the others or the ticket response), each with a 5s timeout. Results logged to `webhook_logs` (extended with a nullable `target` column: `slack|discord|telegram|linear|github|jira|webhook`). Issue-tracker URLs written back to `tickets.external_refs`.

The existing generic `config.webhookUrl` + `notificationEmail` paths stay untouched (backwards compatible).

### Dashboard (`/dashboard/integrations`)
New Settings page, one card per integration:
- Enable switch + credential fields (password inputs for tokens).
- A **"Send test"** button per integration → `POST /api/integrations/test` (auth: Clerk, ownership-checked) fires a sample escalation to that one target and reports success/failure inline. This is how a team verifies setup without waiting for a real escalation.
- Secrets are write-only in the UI: once saved, fields show "•••• configured" and can be replaced but not read back (the page never receives the stored secret — the server returns only booleans/`configured` flags).
- Sidebar: add "Integrations" under Setup.

### Security
- Integration secrets: stored in `config.integrations`, returned to the dashboard only as `{configured: boolean}` per field (a dedicated read shape), never the raw token; never in widget-config; never logged (webhook_logs stores target + status, not payloads/tokens).
- `test` and save actions are Clerk-authed + `resolveProjectWithOwnership`.
- Outbound requests time-boxed (5s) and failure-isolated.

---

## Rollout
1. Feature A first (independent, low-risk, immediate value) — migration, summarise action, ConversationList UI.
2. Feature B — config types, adapters, dispatch wired into tickets route, dashboard page, test endpoint.
3. Marketing: homepage feature card ("Summaries & integrations") + `/security` note (secrets server-side). Docs: help-center "Integrations" + "Conversation insights" entries; docs-site section.
4. Both features are additive and gated by presence of config — zero behaviour change for projects that don't configure them.

## Risks
| Risk | Mitigation |
|---|---|
| Summary cost blowup on big backlogs | Capped batch (8/load), skip <2-msg convos, only re-summarise when new messages exist |
| Secret leakage to client | Whitelist widget-config (unchanged), write-only secret UI, `{configured}` read shape, never logged |
| One broken integration blocks others / the ticket | `Promise.allSettled`, per-call 5s timeout, all async after the ticket row is committed |
| Model returns bad category/JSON | Strict enum validation, fallback to `other/neutral`, never throws |
| Jira/Linear/GitHub API shape drift | Each adapter isolated + covered by the "Send test" button so misconfig is caught immediately |
| Telegram integration without a connected bot | Dashboard disables it unless `telegramBotToken` is set |

## Testing
- Adapters: mocked HTTP per target (success + error shapes) → correct message/issue body, returned URL parsed.
- `dispatchEscalation`: allSettled isolation (one throwing target doesn't sink others), timeout, external_refs writeback.
- Summarise action: enum validation + fallback, stale-selection query, cap, token_usage write.
- Manual QA: configure a real Slack webhook + a GitHub repo, raise a test ticket, confirm message + created issue + URL on the ticket.
- Regression: no integrations + no summaries configured ⇒ tickets + conversations behave exactly as today.

## Open questions (for Howard)
1. Are these paid-plan-gated like Actions, or available on all plans? (Recommendation: summaries free/all plans as a retention hook; integrations paid-plan — they're the "sticky for dev teams" value.)
2. Any integration to prioritise for the first pilot, or ship all six?
