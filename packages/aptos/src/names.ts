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

const FORWARD_QUERY = `query AnsForward($domain: String!, $subdomain: String!) {
  current_aptos_names(
    where: {
      domain: { _eq: $domain }
      subdomain: { _eq: $subdomain }
      is_active: { _eq: true }
    }
    limit: 1
  ) {
    domain
    subdomain
    registered_address
  }
}`

export async function resolveAptosName(name: string): Promise<{ name: string; address: string } | null> {
  const parsed = parseAnsName(name)
  if (!parsed) return null
  const data = await aptosGraphql<{ current_aptos_names: AnsNameRow[] }>(FORWARD_QUERY, {
    domain: parsed.domain,
    subdomain: parsed.subdomain,
  })
  const row = data?.current_aptos_names[0]
  if (!row || !row.registered_address) return null
  return {
    name: displayName(row.domain, row.subdomain),
    address: normalizeAptosAddress(row.registered_address),
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
