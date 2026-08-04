import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import { resolveProtocolAccount } from "@/lib/protocol-account"
import { isAptosAddress } from "@txid/aptos"

/**
 * GET /api/widget/protocol-account?key=pk_…&address=0x…
 *
 * The wallet the user connected is not the account their positions live in.
 * The widget asks this on connect so both addresses can be on screen from the
 * first message, instead of the second one turning up unlabelled halfway
 * through a conversation and reading as a hijack.
 *
 * Returns `off` for every protocol that has no such concept, which is most of
 * them. Nothing here is a secret: the mapping is a public view function, and
 * the caller already knows the wallet address they just connected.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export const dynamic = "force-dynamic"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const key = url.searchParams.get("key")
  const address = url.searchParams.get("address")

  if (!key || !key.startsWith("pk_")) return json({ status: "off" })
  // Subaccounts are an Aptos-only concept today, so anything else is off
  // rather than an error: the widget calls this for every connect.
  if (!address || !isAptosAddress(address)) return json({ status: "off" })

  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from("projects")
    .select("config")
    .eq("publishable_key", key)
    .maybeSingle()

  if (!project) return json({ status: "off" })

  const config = (project as unknown as { config: ProjectConfig }).config
  const result = await resolveProtocolAccount(config, address)

  return new Response(JSON.stringify(result), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      // Deterministic on chain, and the widget re-asks on every connect.
      "Cache-Control": "private, max-age=60",
    },
  })
}
