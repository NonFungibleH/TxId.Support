import { waitUntil } from "@vercel/functions"
import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import { resolveDisclaimer, activeStatusNotice } from "@/lib/types/config"
import { originAllowed, originRefused } from "@/lib/origin-guard"
import { verifyPreviewToken } from "@/lib/preview-token"
import type { Database } from "@/lib/supabase/types"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { TICKET_LIMITS } from "@/lib/limits"
import { dispatchEscalation } from "@/lib/integrations/escalation"
import { coarseDevice, requestGeo } from "@/lib/evidence"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

function webhookSignature(payload: string): string {
  const secret = process.env.WEBHOOK_SECRET ?? ""
  if (!secret) return ""
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function makeRef(): string {
  return "TKT-" + Math.random().toString(36).slice(2, 8).toUpperCase()
}

function isPublicSurface(key: string, config: { publicDemo?: boolean } | null | undefined): boolean {
  const a = process.env.DEMO_WIDGET_KEY
  const b = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY
  return (!!a && key === a) || (!!b && key === b) || config?.publicDemo === true
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)

    // Stricter than chat (creating a ticket emails the team + fires a webhook).
    // Distributed via Upstash when configured; see lib/rate-limit.ts.
    const { allowed } = await rateLimit(`ticket:${ip}`, TICKET_LIMITS.ratePerWindow, TICKET_LIMITS.windowMs)
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": "600" },
      })
    }

    const body = (await request.json()) as {
      key: string
      name?: string
      email?: string
      summary: string
      reason?: string
      /** Free text the user added: what they were doing, what they tried. */
      note?: string
      conversation?: Array<{ role: string; content: string }>
      /** The page the widget is embedded on, for the domain allowlist. */
      pageUrl?: string
      preview?: boolean
      previewToken?: string
      /**
       * The user's wallet, for per-user attribution. Either connected in the
       * widget or supplied by the host site via window.txid.identify(). It is an
       * identifier, never proof of ownership: no signature is involved.
       */
      wallet?: string
    }

    const { key, name, email, summary, reason, conversation, note } = body
    // Cap length so a hostile caller cannot store arbitrary blobs in the field.
    const wallet = typeof body.wallet === "string" && body.wallet.trim()
      ? body.wallet.trim().slice(0, 128)
      : null

    if (!key || !summary) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const supabase = createServiceClient()

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, config, is_active")
      .eq("publishable_key", key)
      .single()

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Invalid key" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const typedProject = project as unknown as ProjectRow & { name: string; is_active: boolean }
    const config = typedProject.config as unknown as ProjectConfig

    // Ticket creation writes rows and fans out to the customer's Slack, Linear
    // and email. An unguarded key made that a spam channel into their tools.
    // A DASHBOARD PREVIEW MUST BE ABLE TO RAISE A TICKET. /api/chat has always
    // exempted a signed preview from the is_active check, and this route never
    // did, so a customer testing before go-live could hold a whole conversation
    // and then hit "Couldn't submit your ticket" at the one step that proves
    // the escalation path works. Preview is the only place they can test it,
    // since the widget is not installed anywhere yet.
    const previewVerified = body.preview === true && verifyPreviewToken(typedProject.id, body.previewToken)

    if (!originAllowed(request, config.allowedDomains, {
      preview: previewVerified,
      publicSurface: isPublicSurface(key, config),
      ...(typeof body.pageUrl === "string" ? { hostPage: body.pageUrl } : {}),
    })) {
      return originRefused(CORS_HEADERS)
    }

    if (!typedProject.is_active && !previewVerified) {
      return new Response(JSON.stringify({ error: "Project inactive" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Truncate inputs to prevent unbounded storage / email abuse
    // The user's own words are APPENDED to the model's summary rather than
    // replacing it, and attributed, so a support agent can see which half came
    // from whom. The model writes what it observed; this is what the person
    // said, and the two are not interchangeable evidence.
    const safeNote = typeof note === "string" ? note.trim().slice(0, TICKET_LIMITS.maxSummaryChars) : ""
    const safeSummary = (
      safeNote ? `${summary}\n\nFrom the user: ${safeNote}` : summary
    ).slice(0, TICKET_LIMITS.maxSummaryChars * 2)
    const safeConversation = (conversation ?? [])
      .slice(0, TICKET_LIMITS.maxConversationMsgs)
      .map(m => ({ ...m, content: m.content.slice(0, TICKET_LIMITS.maxMessageChars) }))

    // Retry up to 3 times on ref collision (unique constraint added in migration 20260627000002)
    let ref = ""
    let ticketDbId: string | null = null
    // The case record for the finding: the request context it was filed under,
    // the same compliance evidence Conversations shows per message. The page
    // comes from the widget (pageUrl); country + device from edge headers and
    // the user agent, coarsened. No raw IP is stored.
    const requestEvidence = {
      surface: "widget" as const,
      ...(typeof body.pageUrl === "string" && body.pageUrl ? { pageUrl: body.pageUrl.slice(0, 2048) } : {}),
      ...requestGeo(request.headers),
      ...coarseDevice(request.headers.get("user-agent")),
    }

    // Built as a mutable payload so we can drop `request` if the column is not
    // applied in prod yet: a bug report must NEVER fail over a compliance
    // nicety. (Postgres 42703 = undefined_column.)
    const payload: Record<string, unknown> = {
      project_id: typedProject.id,
      user_name: name || null,
      user_email: email || null,
      summary: safeSummary,
      reason: reason || null,
      conversation: safeConversation.length ? JSON.stringify(safeConversation) : null,
      wallet_address: wallet,
      request: requestEvidence,
      status: "open",
    }

    let insertError = null
    for (let attempt = 0; attempt < 4; attempt++) {
      ref = makeRef()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase as any).from("tickets").insert({ ...payload, ref }).select("id").single()
      insertError = result.error
      ticketDbId = result.data?.id ?? null
      if (!insertError) break
      if (insertError.code === "42703" && "request" in payload) {
        delete payload.request // column not migrated yet; file the report anyway
        continue
      }
      if (insertError.code !== "23505") break // only retry on unique violation
    }

    if (insertError) {
      console.error("[tickets] insert error:", insertError)
      return new Response(JSON.stringify({ error: "Failed to create ticket" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Optional webhook notification - fires async, logs delivery result
    const webhookUrl = config.webhookUrl
    if (webhookUrl) {
      const webhookPayload = JSON.stringify({
        ref,
        project: typedProject.name,
        summary: safeSummary,
        reason: reason || null,
        user: { name: name || null, email: email || null },
        conversation: safeConversation,
      })
      const sig = webhookSignature(webhookPayload)
      void (async () => {
        const start = Date.now()
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(sig ? { "X-TxID-Signature": sig } : {}),
            },
            body: webhookPayload,
            signal: AbortSignal.timeout(5000),
          })
          const duration = Date.now() - start
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("webhook_logs").insert({
            project_id: typedProject.id,
            ticket_ref: ref,
            webhook_url: webhookUrl,
            status_code: res.status,
            success: res.ok,
            duration_ms: duration,
          })
        } catch (err) {
          const duration = Date.now() - start
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("webhook_logs").insert({
            project_id: typedProject.id,
            ticket_ref: ref,
            webhook_url: webhookUrl,
            status_code: null,
            success: false,
            error_message: err instanceof Error ? err.message : "Unknown error",
            duration_ms: duration,
          }).catch(() => { /* non-fatal */ })
        }
      })()
    }

    // Optional email notification via Resend (no package needed - plain HTTP)
    const notificationEmail = config.notificationEmail
    if (notificationEmail && process.env.RESEND_API_KEY) {
      const conversationText = safeConversation
        .map(m => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`)
        .join("\n")

      const emailBody =
        `New support ticket ${ref} from ${typedProject.name}\n\n` +
        `Name: ${name || "Anonymous"}\n` +
        `Email: ${email || "Not provided"}\n` +
        `Issue: ${safeSummary}\n\n` +
        (conversationText ? `--- Conversation ---\n${conversationText}` : "")

      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TxID <noreply@txid.support>",
          to: [notificationEmail],
          subject: `[${ref}] New support ticket: ${safeSummary.slice(0, 60)}`,
          text: emailBody,
        }),
      }).catch(() => { /* non-fatal */ })
    }

    // While a status notice is up, one issue produces thousands of identical
    // escalations and buries the ones that are actually different. The ticket
    // is still RECORDED, so nothing is lost and the volume is visible; it just
    // does not page the team again for something they raised themselves.
    const notice = activeStatusNotice(config)
    if (notice) {
      return new Response(JSON.stringify({ ref, suppressed: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Fan out to the team's integrations (Slack/Discord/Telegram/Linear/GitHub/Jira).
    //
    // waitUntil, NOT a bare `void`. On Vercel the function can be frozen the
    // instant the response is sent, so fire-and-forget work started just before
    // a return may never run. For a support product that is the worst possible
    // shape of failure: the ticket is in the database and looks fine, and
    // nobody was ever told about it. Same reason the chat route persists its
    // messages this way.
    waitUntil(dispatchEscalation(
      supabase,
      typedProject.id,
      ticketDbId,
      {
        ref,
        projectName: typedProject.name,
        summary: safeSummary,
        reason: reason || null,
        userName: name || null,
        userEmail: email || null,
        conversation: safeConversation,
        disclaimer: resolveDisclaimer(config.branding) || null,
      },
      config.integrations,
      config.telegramBotToken ?? undefined,
    ))

    return new Response(JSON.stringify({ ref }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[tickets/POST]", err)
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
}
