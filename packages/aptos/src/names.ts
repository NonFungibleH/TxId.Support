import { normalizeAptosAddress } from "./address"
import { aptosGraphql } from "./indexer"

// ANS (Aptos Names / .apt) resolution. The public aptosnames.com REST API was
// deprecated (v1 sunset 2026-04-14) and v3 now requires a separate aptosnames
// API key we don't provision, so we resolve against the Aptos Indexer's
// current_aptos_names table instead: keyless, and it rides the same
// aptosFetch/aptosAuthHeaders discipline (and APTOS_API_KEY rate limits) as the
// rest of the package. A name is `[subdomain.]domain.apt`.

interface AnsNameRow {
  domain: string
  subdomain: string
  registered_address: string | null
  owner_address?: string | null
  is_active?: boolean | null
  expiration_timestamp?: string | null
}

// Split a user-supplied name into its ANS parts. Accepts input with or without
// the ".apt" suffix; the label before ".apt" is the domain, an optional single
// label ahead of it is the subdomain.
function parseAnsName(input: string): { domain: string; subdomain: string } | null {
  const trimmed = input.trim().toLowerCase().replace(/\.apt$/, "")
  if (trimmed === "") return null
  const parts = trimmed.split(".")
  const domain = parts[parts.length - 1]
  if (!domain) return null
  const subdomain = parts.length > 1 ? parts.slice(0, -1).join(".") : ""
  return { domain, subdomain }
}

function displayName(domain: string, subdomain: string): string {
  return subdomain ? `${subdomain}.${domain}.apt` : `${domain}.apt`
}

// NOTE: deliberately NOT filtered on is_active. Filtering it out made an
// EXPIRED name indistinguishable from one that was never registered, and the
// caller then told the user "that name is not registered", which is false and
// unhelpful: an expired name has an owner, a history, and can be re-registered.
const FORWARD_QUERY = `query AnsForward($domain: String!, $subdomain: String!) {
  current_aptos_names(
    where: {
      domain: { _eq: $domain }
      subdomain: { _eq: $subdomain }
    }
    order_by: { expiration_timestamp: desc }
    limit: 1
  ) {
    domain
    subdomain
    registered_address
    owner_address
    is_active
    expiration_timestamp
  }
}`

export type AnsResolution =
  | { status: "active"; name: string; address: string; expiresAt: string | null }
  /** Registered before, but the registration has lapsed. Re-registerable. */
  | { status: "expired"; name: string; address: string | null; owner: string | null; expiredAt: string | null }
  /** The indexer answered and knows nothing about this name. */
  | { status: "unregistered"; name: string }

/**
 * Resolve a .apt name. Returns null ONLY when the lookup itself failed, so the
 * caller can keep "we could not check" separate from the three real answers.
 */
export async function resolveAptosName(name: string): Promise<AnsResolution | null> {
  const parsed = parseAnsName(name)
  if (!parsed) return null
  const data = await aptosGraphql<{ current_aptos_names: AnsNameRow[] }>(FORWARD_QUERY, {
    domain: parsed.domain,
    subdomain: parsed.subdomain,
  })
  if (!data || !Array.isArray(data.current_aptos_names)) return null

  const row = data.current_aptos_names[0]
  const shown = displayName(parsed.domain, parsed.subdomain)
  if (!row) return { status: "unregistered", name: shown }

  const label = displayName(row.domain, row.subdomain)
  if (row.is_active === false) {
    return {
      status: "expired",
      name: label,
      address: row.registered_address ? normalizeAptosAddress(row.registered_address) : null,
      owner: row.owner_address ? normalizeAptosAddress(row.owner_address) : null,
      expiredAt: row.expiration_timestamp ?? null,
    }
  }
  if (!row.registered_address) return { status: "unregistered", name: shown }
  return {
    status: "active",
    name: label,
    address: normalizeAptosAddress(row.registered_address),
    expiresAt: row.expiration_timestamp ?? null,
  }
}

const REVERSE_QUERY = `query AnsReverse($address: String!) {
  current_aptos_names(
    where: {
      registered_address: { _eq: $address }
      is_primary: { _eq: true }
      is_active: { _eq: true }
    }
    limit: 1
  ) {
    domain
    subdomain
  }
}`

// Best-effort friendly name for an address (its primary ANS name), for display.
export async function reverseAptosName(address: string): Promise<string | null> {
  const data = await aptosGraphql<{ current_aptos_names: { domain: string; subdomain: string }[] }>(REVERSE_QUERY, {
    address: normalizeAptosAddress(address),
  })
  const row = data?.current_aptos_names[0]
  if (!row) return null
  return displayName(row.domain, row.subdomain)
}
