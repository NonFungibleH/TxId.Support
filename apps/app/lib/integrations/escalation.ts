import { decryptIntegrations } from "@/lib/secrets"
import type { createServiceClient } from "@/lib/supabase/server"
import type { Integrations, IntegrationTarget } from "@/lib/types/config"

// Escalation fan-out: when a ticket is raised, notify where the team lives
// (Slack/Discord/Telegram) and open a tracked issue (Linear/GitHub/Jira),
// writing the created issue URL back onto the ticket. Every target is isolated
// (allSettled + per-call timeout) so one broken integration never blocks the
// others or the ticket response. Slack/Discord webhook URLs are secrets - we
// never log them.

export interface EscalationTicket {
  ref: string
  projectName: string
  summary: string
  reason?: string | null
  userName?: string | null
  userEmail?: string | null
  wallet?: string | null
  conversation?: Array<{ role: string; content: string }>
  /**
   * The protocol's standing disclaimer, carried onto the handoff.
   *
   * WHY IT TRAVELS: a transcript read weeks later in Jira, by someone who was
   * never in the conversation, is exactly where an assistant's answer gets
   * mistaken for the protocol's formal position. The disclaimer the user saw
   * should be attached to the record they saw it in.
   */
  disclaimer?: string | null
}

type AdapterResult = { ok: boolean; url?: string; error?: string }
const TIMEOUT = 5000

function transcript(t: EscalationTicket, max = 20): string {
  return (t.conversation ?? [])
    .slice(-max)
    .map(m => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`)
    .join("\n")
}

function plainBody(t: EscalationTicket): string {
  const lines = [
    `*${t.ref}* - ${t.projectName}`,
    `Issue: ${t.summary}`,
    t.reason ? `Reason: ${t.reason}` : "",
    t.userName || t.userEmail ? `User: ${t.userName ?? "Anonymous"}${t.userEmail ? ` <${t.userEmail}>` : ""}` : "",
    t.wallet ? `Wallet: ${t.wallet}` : "",
  ].filter(Boolean)
  const tx = transcript(t)
  const foot = t.disclaimer ? `\n\n---\n${t.disclaimer}` : ""
  return lines.join("\n") + (tx ? `\n\n--- Conversation ---\n${tx}` : "") + foot
}

function issueTitle(t: EscalationTicket): string {
  return `[${t.ref}] ${t.summary.slice(0, 120)}`
}

function issueBody(t: EscalationTicket): string {
  return plainBody(t)
}

/** Backoff schedule per attempt, in ms: ~1m, 5m, 30m, 2h, 6h. */
export const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000]
export const MAX_ATTEMPTS = BACKOFF_MS.length

/**
 * Worth trying again? A timeout, a rate limit or a 5xx is the other end having
 * a bad moment. A 401 or a 404 is configuration, and retrying it just fails
 * five more times.
 */
export function isTransient(error: string | undefined): boolean {
  if (!error) return true
  const e = error.toLowerCase()
  // Configuration, not a blip: a bad token or a deleted channel will fail the
  // same way five more times, and each retry delays the ones worth making.
  if (/\b(400|401|403|404|410|422)\b|unauthor|forbidden|not found|invalid|revoked/.test(e)) {
    return false
  }
  // Everything else retries. Losing an escalation is worse than a wasted call.
  return true
}

async function attempt(run: () => Promise<AdapterResult>): Promise<AdapterResult> {
  try {
    return await run()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "error" }
  }
}

async function timed<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT)),
  ])
}

// ── Notification adapters ────────────────────────────────────────────────────

async function toSlack(t: EscalationTicket, cfg: NonNullable<Integrations["slack"]>): Promise<AdapterResult> {
  const res = await timed(fetch(cfg.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: plainBody(t) }),
  }))
  return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` }
}

async function toDiscord(t: EscalationTicket, cfg: NonNullable<Integrations["discord"]>): Promise<AdapterResult> {
  const res = await timed(fetch(cfg.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: plainBody(t).slice(0, 1900) }),
  }))
  return { ok: res.ok || res.status === 204, error: res.ok || res.status === 204 ? undefined : `HTTP ${res.status}` }
}

async function toTelegram(t: EscalationTicket, cfg: NonNullable<Integrations["telegram"]>, botToken: string | undefined): Promise<AdapterResult> {
  if (!botToken) return { ok: false, error: "No Telegram bot connected" }
  const res = await timed(fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: cfg.chatId, text: plainBody(t).replace(/\*/g, ""), disable_web_page_preview: true }),
  }))
  return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` }
}

// ── Issue-tracker adapters (return the created issue URL) ────────────────────

async function toLinear(t: EscalationTicket, cfg: NonNullable<Integrations["linear"]>): Promise<AdapterResult> {
  const query = `mutation($title:String!,$desc:String,$team:String!){issueCreate(input:{title:$title,description:$desc,teamId:$team}){success issue{url}}}`
  const res = await timed(fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: cfg.apiKey },
    body: JSON.stringify({ query, variables: { title: issueTitle(t), desc: issueBody(t), team: cfg.teamId } }),
  }))
  const body = (await res.json().catch(() => ({}))) as { data?: { issueCreate?: { success?: boolean; issue?: { url?: string } } }; errors?: unknown }
  const url = body.data?.issueCreate?.issue?.url
  return body.data?.issueCreate?.success && url ? { ok: true, url } : { ok: false, error: "Linear issueCreate failed" }
}

async function toGithub(t: EscalationTicket, cfg: NonNullable<Integrations["github"]>): Promise<AdapterResult> {
  const res = await timed(fetch(`https://api.github.com/repos/${cfg.repo}/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "TxID-Support" },
    body: JSON.stringify({ title: issueTitle(t), body: issueBody(t) }),
  }))
  const body = (await res.json().catch(() => ({}))) as { html_url?: string; message?: string }
  return res.ok && body.html_url ? { ok: true, url: body.html_url } : { ok: false, error: body.message ?? `HTTP ${res.status}` }
}

async function toJira(t: EscalationTicket, cfg: NonNullable<Integrations["jira"]>): Promise<AdapterResult> {
  const auth = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64")
  // Description must be an Atlassian Document Format (ADF) doc, not plain text.
  const adf = {
    type: "doc", version: 1,
    content: issueBody(t).split("\n").map(line => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  }
  const res = await timed(fetch(`https://${cfg.domain}/rest/api/3/issue`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { project: { key: cfg.projectKey }, summary: issueTitle(t), description: adf, issuetype: { name: "Task" } } }),
  }))
  const body = (await res.json().catch(() => ({}))) as { key?: string; errorMessages?: string[] }
  return res.ok && body.key
    ? { ok: true, url: `https://${cfg.domain}/browse/${body.key}` }
    : { ok: false, error: body.errorMessages?.join("; ") ?? `HTTP ${res.status}` }
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

const TRACKERS: IntegrationTarget[] = ["linear", "github", "jira"]

/** Run one target with a sample ticket (the dashboard "Send test" button). */
export async function testIntegration(
  target: IntegrationTarget,
  integrations: Integrations,
  telegramBotToken: string | undefined,
): Promise<AdapterResult> {
  integrations = decryptIntegrations(integrations)
  const sample: EscalationTicket = {
    ref: "TKT-TEST",
    projectName: "TxID test",
    summary: "Test escalation from your TxID dashboard - you can ignore this.",
    reason: "integration test",
    conversation: [
      { role: "user", content: "This is a test message." },
      { role: "assistant", content: "This confirms your integration is wired up correctly." },
    ],
  }
  try {
    if (target === "slack" && integrations.slack) return await toSlack(sample, integrations.slack)
    if (target === "discord" && integrations.discord) return await toDiscord(sample, integrations.discord)
    if (target === "telegram" && integrations.telegram) return await toTelegram(sample, integrations.telegram, telegramBotToken)
    if (target === "linear" && integrations.linear) return await toLinear(sample, integrations.linear)
    if (target === "github" && integrations.github) return await toGithub(sample, integrations.github)
    if (target === "jira" && integrations.jira) return await toJira(sample, integrations.jira)
    return { ok: false, error: "Not configured" }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "error" }
  }
}

/** Fan the ticket out to every enabled integration. Fire-and-forget safe. */
/**
 * Deliver one escalation to one target. Used by the retry worker, which has a
 * stored payload and a single destination rather than a fresh fan-out.
 */
export async function deliverOne(
  target: IntegrationTarget,
  ticket: EscalationTicket,
  integrations: Integrations,
  telegramBotToken: string | undefined,
): Promise<AdapterResult> {
  const cfg = decryptIntegrations(integrations)
  switch (target) {
    case "slack":    return cfg.slack ? attempt(() => toSlack(ticket, cfg.slack!)) : { ok: false, error: "not configured" }
    case "discord":  return cfg.discord ? attempt(() => toDiscord(ticket, cfg.discord!)) : { ok: false, error: "not configured" }
    case "telegram": return cfg.telegram ? attempt(() => toTelegram(ticket, cfg.telegram!, telegramBotToken)) : { ok: false, error: "not configured" }
    case "linear":   return cfg.linear ? attempt(() => toLinear(ticket, cfg.linear!)) : { ok: false, error: "not configured" }
    case "github":   return cfg.github ? attempt(() => toGithub(ticket, cfg.github!)) : { ok: false, error: "not configured" }
    case "jira":     return cfg.jira ? attempt(() => toJira(ticket, cfg.jira!)) : { ok: false, error: "not configured" }
    default:         return { ok: false, error: "unknown target" }
  }
}

/**
 * Which destinations a dispatch would fan out to. Keep in step with the job
 * list inside dispatchEscalation; a test pins all six.
 */
export function enabledTargets(integrations: Integrations | undefined): IntegrationTarget[] {
  if (!integrations) return []
  const i = decryptIntegrations(integrations)
  const out: IntegrationTarget[] = []
  if (i.slack?.enabled && i.slack.webhookUrl) out.push("slack")
  if (i.discord?.enabled && i.discord.webhookUrl) out.push("discord")
  if (i.telegram?.enabled && i.telegram.chatId) out.push("telegram")
  if (i.linear?.enabled && i.linear.apiKey && i.linear.teamId) out.push("linear")
  if (i.github?.enabled && i.github.token && i.github.repo) out.push("github")
  if (i.jira?.enabled && i.jira.apiToken && i.jira.domain && i.jira.projectKey) out.push("jira")
  return out
}

/**
 * Park an escalation for delivery later, without paging anyone now.
 *
 * While a service update is up, /api/tickets records the ticket and skips the
 * fan-out, because one incident otherwise produces thousands of identical
 * pages. That was the right call and it had a hole: nothing ever delivered
 * those escalations afterwards. The row existed in `tickets`; Slack, Linear
 * and the retry worker never heard of it. When the update cleared, the
 * operator had to remember to go and look.
 *
 * This writes one `pending` row per enabled destination into
 * escalation_deliveries with `next_attempt_at` set to when the notice is due
 * to clear, so the existing retry worker delivers them on its next pass.
 * Nothing new runs; the worker that already exists does the work.
 */
export async function holdEscalation(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  ticket: EscalationTicket,
  integrations: Integrations | undefined,
  deliverAt: string,
): Promise<number> {
  const targets = enabledTargets(integrations)
  if (targets.length === 0) return 0
  const rows = targets.map(target => ({
    project_id: projectId,
    target,
    ticket_ref: ticket.ref,
    payload: ticket,
    status: "pending",
    attempts: 0,
    last_error: "held: a service update was active when this was raised",
    next_attempt_at: deliverAt,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("escalation_deliveries").insert(rows)
  return error ? 0 : rows.length
}

export async function dispatchEscalation(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  ticketDbId: string | null,
  ticket: EscalationTicket,
  integrations: Integrations | undefined,
  telegramBotToken: string | undefined,
): Promise<void> {
  if (!integrations) return
  // Credentials are stored encrypted; decrypt once, here, at the point of use.
  integrations = decryptIntegrations(integrations)

  const jobs: { target: IntegrationTarget; run: () => Promise<AdapterResult> }[] = []
  if (integrations.slack?.enabled && integrations.slack.webhookUrl) jobs.push({ target: "slack", run: () => toSlack(ticket, integrations.slack!) })
  if (integrations.discord?.enabled && integrations.discord.webhookUrl) jobs.push({ target: "discord", run: () => toDiscord(ticket, integrations.discord!) })
  if (integrations.telegram?.enabled && integrations.telegram.chatId) jobs.push({ target: "telegram", run: () => toTelegram(ticket, integrations.telegram!, telegramBotToken) })
  if (integrations.linear?.enabled && integrations.linear.apiKey && integrations.linear.teamId) jobs.push({ target: "linear", run: () => toLinear(ticket, integrations.linear!) })
  if (integrations.github?.enabled && integrations.github.token && integrations.github.repo) jobs.push({ target: "github", run: () => toGithub(ticket, integrations.github!) })
  if (integrations.jira?.enabled && integrations.jira.apiToken && integrations.jira.domain && integrations.jira.projectKey) jobs.push({ target: "jira", run: () => toJira(ticket, integrations.jira!) })
  if (jobs.length === 0) return

  const externalRefs: Record<string, string> = {}

  await Promise.allSettled(
    jobs.map(async ({ target, run }) => {
      const start = Date.now()
      // Most failures are a blip: a cold Lambda, a brief 5xx, a rate limit.
      // One immediate retry clears the majority without waiting for a worker.
      let result = await attempt(run)
      if (!result.ok && isTransient(result.error)) {
        await new Promise(r => setTimeout(r, 400))
        result = await attempt(run)
      }
      if (result.ok && result.url && TRACKERS.includes(target)) externalRefs[target] = result.url

      // Still failing: park the payload so it can actually be redelivered.
      // A lost escalation means a user was promised a human who never hears.
      if (!result.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("escalation_deliveries").insert({
          project_id: projectId,
          target,
          ticket_ref: ticket.ref,
          payload: ticket,
          status: "pending",
          attempts: 1,
          last_error: (result.error ?? "failed").slice(0, 500),
          next_attempt_at: new Date(Date.now() + BACKOFF_MS[0]!).toISOString(),
        }).catch(() => { /* table may not exist pre-migration */ })
      }
      // Log target + status only - never the Slack/Discord webhook URL (secret).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("webhook_logs").insert({
        project_id: projectId,
        ticket_ref: ticket.ref,
        target,
        webhook_url: null,
        success: result.ok,
        error_message: result.ok ? null : (result.error ?? "failed"),
        duration_ms: Date.now() - start,
      }).catch(() => { /* non-fatal */ })
    }),
  )

  if (ticketDbId && Object.keys(externalRefs).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("tickets").update({ external_refs: externalRefs }).eq("id", ticketDbId).catch(() => { /* non-fatal */ })
  }
}
