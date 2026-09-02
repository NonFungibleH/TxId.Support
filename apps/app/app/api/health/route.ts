import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/health
 *
 * Exists so that something can be pointed at production and told the
 * difference between "down" and "up but a provider is failing". Every incident
 * this week was found by a customer; nothing on our side could say whether
 * the app itself was serving. This answers only that. It deliberately does
 * NOT probe chains or the database: a health check that depends on third
 * parties pages you for their outages, and the live-check workflow already
 * covers the providers on a schedule.
 *
 * Public in middleware. Reveals the deployed commit and nothing else.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "txid-app",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
