import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { crawlAndIngestCore } from "@/lib/ingest-core"
import type { ProjectConfig } from "@/lib/types/config"
import { DOCS_SYNC_INTERVAL_MS } from "@/lib/types/config"

/**
 * Re-crawl documentation that has gone stale.
 *
 * The point of this is NOT the schedule, it is the change detection underneath
 * it. `crawlAndIngestCore` now asks the origin what changed (ETag, then
 * Last-Modified, then a content hash) and only re-embeds pages that moved, so
 * a run over an unchanged site costs a handful of conditional requests and no
 * embedding at all. That is what makes running this often affordable.
 *
 * It also prunes: a page removed from the documentation gets its chunks
 * deleted, so the assistant stops answering from pages that no longer exist.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Crawling is slow and rate-limited upstream, so keep each run small. */
const BATCH = 3

/**
 * Says WHICH side is wrong, without ever revealing the value.
 *
 * A bare 401 turned this into a guessing game between "the server has no
 * secret" and "the caller sent the wrong one", which are opposite fixes: one
 * is a Vercel variable and a redeploy, the other is a GitHub secret. Naming
 * the side leaks nothing an attacker can use, because a server with no secret
 * configured is already refusing everything.
 */
function authorised(req: NextRequest): { ok: true } | { ok: false; why: string } {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")

  // Vercel Cron signs its own scheduled calls. Not used now that the schedules
  // live in GitHub Actions, but harmless to keep.
  if (req.headers.get("x-vercel-cron") !== null) return { ok: true }

  if (!secret) {
    return {
      ok: false,
      why: "CRON_SECRET is not set on the server. Add it to the APP Vercel project, then REDEPLOY: an environment variable only reaches a new deployment.",
    }
  }
  if (!auth) return { ok: false, why: "No Authorization header was sent." }
  if (auth === `Bearer ${secret}`) return { ok: true }
  return {
    ok: false,
    why: "The token sent does not match CRON_SECRET on the server. The two values differ, commonly by a trailing newline or space when one of them was pasted.",
  }
}

export async function GET(req: NextRequest) {
  const auth = authorised(req)
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorised", detail: auth.why }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, config")
    .eq("is_active", true)

  if (error) {
    return NextResponse.json({ error: error.message ?? "query failed" }, { status: 500 })
  }

  const now = Date.now()
  const candidates: { id: string; name: string; docsUrl: string }[] = []

  for (const row of (projects ?? []) as unknown as Array<{ id: string; name: string; config: ProjectConfig }>) {
    const config = row.config ?? ({} as ProjectConfig)
    if (config.docsSync?.enabled !== true) continue
    const docsUrl = config.docsUrl
    if (!docsUrl) continue

    // Due when the OLDEST page has not been checked within the interval. Using
    // the oldest rather than the newest means a page added late does not keep
    // resetting the clock for everything else.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: oldest } = await (supabase as any)
      .from("doc_sources")
      .select("last_checked_at")
      .eq("project_id", row.id)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle()

    const lastChecked = oldest?.last_checked_at ? new Date(oldest.last_checked_at).getTime() : 0
    const interval = DOCS_SYNC_INTERVAL_MS[config.docsSync.frequency ?? "daily"]
    if (now - lastChecked < interval) continue

    candidates.push({ id: row.id, name: row.name, docsUrl })
  }

  // Oldest first is implicit: anything never crawled has lastChecked 0 and
  // sorts to the front of the list we built.
  const due = candidates.slice(0, BATCH)
  if (due.length === 0) {
    return NextResponse.json({ eligible: candidates.length, ran: 0, results: [] })
  }

  const results: Array<Record<string, unknown>> = []
  for (const project of due) {
    try {
      const res = await crawlAndIngestCore(supabase, project.id, project.docsUrl)
      results.push({
        project: project.name,
        ok: res.ok,
        ...(res.ok
          ? { changed: res.pagesIndexed ?? 0, unchanged: res.unchanged ?? 0, pruned: res.pruned ?? 0 }
          : { error: res.error }),
      })
    } catch (err) {
      // One project's broken docs site must not stop the rest of the batch.
      results.push({ project: project.name, ok: false, error: err instanceof Error ? err.message : "crawl failed" })
    }
  }

  return NextResponse.json({ eligible: candidates.length, ran: due.length, results })
}
