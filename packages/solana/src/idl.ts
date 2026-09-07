/**
 * Anchor IDLs used to be servable from public registries. They are not.
 *
 * `anchor.projectserum.com` (which this called) and `api.apr.dev` are both
 * gone: neither resolves, verified 2026-09-07. The old implementation swallowed
 * that into `null`, which the caller could not tell from "this program has no
 * IDL" — the absence-is-not-a-finding bug, silently true for however long the
 * registry has been down.
 *
 * The IDL still exists ON CHAIN for programs that published one: Anchor writes
 * it to an account derived from the program id, zlib-compressed. Reading it
 * needs base58 plus the PDA derivation, which is a dependency this package does
 * not have yet. Until then this reports honestly that it cannot be fetched,
 * rather than reporting that there is none.
 */
export type IdlLookup =
  | { kind: "ok"; idl: string }
  | { kind: "unavailable"; reason: string }

export async function fetchIdl(_programAddress: string): Promise<IdlLookup> {
  return {
    kind: "unavailable",
    reason:
      "The public Anchor IDL registries have been shut down, and reading the on-chain IDL account is not implemented yet. Paste the IDL to give the assistant the program's error definitions.",
  }
}

/**
 * @deprecated Returns null ALWAYS, and null here has never meant "no IDL", it
 * meant "we could not ask". Use `fetchIdl`, which says which.
 */
export async function fetchIdlFromRegistry(_programAddress: string): Promise<string | null> {
  return null
}
