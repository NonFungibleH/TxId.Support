import type { createServiceClient } from "@/lib/supabase/server"
import type { Integrations, IntegrationTarget } from "@/lib/types/config"

// Escalation fan-out: when a ticket is raised, notify where the team lives
// (Slack/Discord/Telegram) and open a tracked issue (Linear/GitHub/Jira),
// writing the created issue URL back onto the ticket. Every target is isolated
// (allSettled + per-call timeout) so one broken integration never blocks the
// others or the ticket response. Slack/Discord webhook URLs are secrets — we
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
    `*${t.ref}* — ${t.projectName}`,
    `Issue: ${t.summary}`,
    t.reason ? `Reason: ${t.reason}` : "",
    t.userName || t.userEmail ? `User: ${t.userName ?? "Anonymous"}${t.userEmail ? ` <${t.userEmail}>` : ""}` : "",
    t.wallet ? `Wallet: ${t.wallet}` : "",
  ].filter(Boolean)
  const tx = transcript(t)
  return lines.join("\n") + (tx ? `\n\n--- Conversation ---\n${tx}` : "")
}

function issueTitle(t: EscalationTicket): string {
  return `[${t.ref}] ${t.summary.slice(0, 120)}`
}

function issueBody(t: EscalationTicket): string {
  return plainBody(t)
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
  const sample: EscalationTicket = {
    ref: "TKT-TEST",
    projectName: "TxID test",
    summary: "Test escalation from your TxID dashboard — you can ignore this.",
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
export async function dispatchEscalation(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  ticketDbId: string | null,
  ticket: EscalationTicket,
  integrations: Integrations | undefined,
  telegramBotToken: string | undefined,
): Promise<void> {
  if (!integrations) return

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
      let result: AdapterResult
      try {
        result = await run()
      } catch (err) {
        result = { ok: false, error: err instanceof Error ? err.message : "error" }
      }
      if (result.ok && result.url && TRACKERS.includes(target)) externalRefs[target] = result.url
      // Log target + status only — never the Slack/Discord webhook URL (secret).
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
