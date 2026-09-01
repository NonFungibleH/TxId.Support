import { createServiceClient } from "@/lib/supabase/server"
import { log } from "@/lib/logger"

/**
 * The customer/wallet mapping: writes and the three reads the Console needs.
 *
 * Recording a NEW pair supersedes the old one rather than overwriting it, so a
 * case answered months ago can still be read against the wallet the customer
 * held at the time.
 */
export type IdentitySource = "pushed" | "crm_field" | "manual"

export interface IdentityRecord {
  customerRef: string
  email: string | null
  displayName: string | null
  wallet: string
  chain: string
  source: IdentitySource
  createdAt: string
}

/** Rows come back from PostgREST untyped; this is their shape. */
interface Row {
  customer_ref: string
  email: string | null
  display_name: string | null
  wallet: string
  chain: string
  source: IdentitySource
  created_at: string
}

const toRecord = (r: Row): IdentityRecord => ({
  customerRef: r.customer_ref,
  email: r.email,
  displayName: r.display_name,
  wallet: r.wallet,
  chain: r.chain,
  source: r.source,
  createdAt: r.created_at,
})

/**
 * Record a customer/wallet pair.
 *
 * Unlike recordResolution this one REPORTS failure, because the caller is an
 * API client that needs to know whether their mapping was stored. A silent
 * failure here would leave a protocol believing their integration works while
 * every future lookup misses.
 */
export async function recordIdentity(
  projectId: string,
  input: {
    customerRef: string
    wallet: string
    chain: string
    source: IdentitySource
    email?: string | null
    displayName?: string | null
  },
): Promise<{ ok: true; superseded: boolean } | { ok: false; reason: string }> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Same wallet already current? Do nothing rather than growing the history
    // with duplicates every time a protocol replays their backfill.
    const { data: existing } = await db
      .from("customer_identities")
      .select("id, wallet")
      .eq("project_id", projectId)
      .eq("customer_ref", input.customerRef)
      .is("superseded_at", null)
      .order("created_at", { ascending: false })
      .limit(1)

    const current = (existing ?? [])[0] as { id: string; wallet: string } | undefined
    if (current && current.wallet.toLowerCase() === input.wallet.toLowerCase()) {
      return { ok: true, superseded: false }
    }

    const { error } = await db.from("customer_identities").insert({
      project_id: projectId,
      customer_ref: input.customerRef,
      email: input.email ?? null,
      display_name: input.displayName ?? null,
      wallet: input.wallet,
      chain: input.chain,
      source: input.source,
    })
    if (error) return { ok: false, reason: error.message }

    // Stamp the old row only after the new one is safely in: a crash between
    // the two leaves two current rows, which the newest-first read tolerates,
    // whereas the reverse order leaves a customer with no wallet at all.
    if (current) {
      await db
        .from("customer_identities")
        .update({ superseded_at: new Date().toISOString() })
        .eq("id", current.id)
    }
    return { ok: true, superseded: Boolean(current) }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown"
    log.warn("identity not recorded", { event: "identity.record_failed", reason })
    return { ok: false, reason }
  }
}

/** The wallet a customer holds now. Null when we have never been told. */
export async function currentWallet(projectId: string, customerRef: string): Promise<IdentityRecord | null> {
  return first(projectId, q => q.eq("customer_ref", customerRef))
}

/** Who holds this wallet. The Console's reverse lookup from a resolution. */
export async function customerForWallet(projectId: string, wallet: string): Promise<IdentityRecord | null> {
  return first(projectId, q => q.ilike("wallet", wallet))
}

/** Search by the thing an agent actually has: an email address. */
export async function findByEmail(projectId: string, email: string): Promise<IdentityRecord | null> {
  return first(projectId, q => q.ilike("email", email))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function first(projectId: string, narrow: (q: any) => any): Promise<IdentityRecord | null> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (supabase as any)
      .from("customer_identities")
      .select("customer_ref, email, display_name, wallet, chain, source, created_at")
      .eq("project_id", projectId)
      .is("superseded_at", null)
    const { data, error } = await narrow(base).order("created_at", { ascending: false }).limit(1)
    if (error || !data?.length) return null
    return toRecord(data[0] as Row)
  } catch {
    // Table may not exist yet on a deployment that has not run the migration.
    return null
  }
}
