import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import { activationOn } from "@/lib/types/config"
import { classifyWallet, ACTIVATION_WINDOW_DAYS, type CohortRow } from "@/lib/activation/cohort"
import { readProtocolHistory } from "@/lib/activation/facts"
import { applyUpdate } from "@/lib/activation/store"

/**
 * Re-check wallets the readiness check has seen, for their whole window.
 *
 * WHY THIS EXISTS: the widget only re-checks while the page is open. A wallet
 * that connects, closes the tab and makes its first deposit tomorrow would
 * otherwise never be recorded as activated, and the holdout, which never sees
 * the checklist, would be undercounted in exactly the same way. Both groups
 * are checked by this one job on the same schedule, so neither is favoured.
 *
 * One day past the window, so the check that closes it can see the whole
 * window. Bounded per run: oldest-checked first, so a large cohort cannot
 * starve its own tail or run past the function timeout.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BATCH = 100
const DAY = 86_400_000

function authorised(req: NextRequest): { ok: true } | { ok: false; why: string } {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get("authorization")?.trim()
  if (!secret) {
    return { ok: false, why: "CRON_SECRET is not set on the server. Add it to the APP Vercel project, then REDEPLOY." }
  }
  if (!auth) return { ok: false, why: "No Authorization header was sent." }
  if (auth === `Bearer ${secret}`) return { ok: true }
  return { ok: false, why: "The token sent does not match CRON_SECRET on the server." }
}

export async function GET(req: NextRequest) {
  const auth = authorised(req)
  if (!auth.ok) return NextResponse.json({ error: "Unauthorised", detail: auth.why }, { status: 401 })

  const supabase = createServiceClient()
  const since = new Date(Date.now() - (ACTIVATION_WINDOW_DAYS + 1) * DAY).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("activation_wallets")
    .select("project_id, wallet_address, status, first_seen_at, activated_at")
    .is("activated_at", null)
    .in("status", ["pending", "new"])
    .gte("first_seen_at", since)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH)
  if (error) {
    // Not applied yet is not an outage: nothing can have been recorded, so
    // there is nothing to re-check. Anything else is a real failure and fails
    // the run.
    const msg = String(error.message ?? "")
    if (/activation_wallets/.test(msg) && /does not exist|could not find/i.test(msg)) {
      return NextResponse.json({ due: 0, note: "activation_wallets is not applied yet" })
    }
    return NextResponse.json({ error: msg || "query failed" }, { status: 500 })
  }

  const rows = (data ?? []) as (Pick<CohortRow, "wallet_address" | "status" | "first_seen_at" | "activated_at"> & { project_id: string })[]
  if (rows.length === 0) return NextResponse.json({ due: 0 })

  const ids = Array.from(new Set(rows.map(r => r.project_id)))
  const { data: projects } = await supabase.from("projects").select("id, config").in("id", ids)
  const configs = new Map((projects ?? []).map(p => [p.id as string, p.config as unknown as ProjectConfig]))

  let checked = 0, unread = 0, activated = 0, skipped = 0
  for (const r of rows) {
    const config = configs.get(r.project_id)
    // A project that turned activation off stops costing reads at once.
    if (!config || !activationOn(config)) { skipped++; continue }
    const history = await readProtocolHistory(config, r.wallet_address)
    if (history.kind !== "ok") { unread++; continue }
    const update = classifyWallet(r, history, Date.now())
    await applyUpdate(r.project_id, r.wallet_address, update)
    checked++
    if (update.activated_at) activated++
  }
  return NextResponse.json({ due: rows.length, checked, unread, activated, skipped })
}
