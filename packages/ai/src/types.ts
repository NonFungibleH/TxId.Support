export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ErrorGlossaryEntry {
  error: string         // error or event name, e.g. "SlippageTooHigh" or "LockAdded"
  explanation: string   // plain-English description set by the protocol team
  kind?: "error" | "event"
}

export interface WatchedContractSnapshot {
  id: string
  name: string
  address: string
  chain: string
  description: string
  // Aptos only: scopes contract tools to this single module at the address
  // (Aptos accounts can host many modules).
  moduleName?: string
  errorGlossary?: ErrorGlossaryEntry[]
  abi?: string          // ABI JSON string, auto-fetched from explorer or user-uploaded
  abiSource?: "explorer" | "uploaded"
}

export interface TokenConfigSnapshot {
  address: string
  chain: string
  symbol: string | null
  name: string | null
  dexUrl: string | null
}

export interface AuditSnapshot {
  auditor: string
  url: string
  date?: string | null
}

export interface ProjectConfigSnapshot {
  token: TokenConfigSnapshot | null
  watchedContracts: WatchedContractSnapshot[]
  docsUrl: string | null
  audits?: AuditSnapshot[]
  /** Curated documentation/KB page links (from the "docs" content block) the
   *  bot can point users to for more detail. */
  docLinks?: { label: string; url: string }[]
}

export interface RagChunk {
  content: string
  source: string | null
  score: number
}

export interface RagResult {
  context: string
  chunks: RagChunk[]
  /**
   * How many chunks survived the character budget. Fewer than `chunks.length`
   * means the rest were cut, which is worth knowing: it is the difference
   * between "the docs did not say" and "the docs said it in the part we
   * dropped".
   */
  includedChunks: number
  /** Characters of documentation actually sent. This is prompt spend. */
  contextChars: number
}

/** Resolved per-user protocol account. `failed` is never rendered as `none`. */
export type ProtocolAccountContext =
  | { status: "ok"; protocol: string; label: string; address: string }
  | { status: "none"; protocol: string; label: string }
  | { status: "failed"; protocol: string; label: string }

export interface StreamChatParams {
  projectName: string
  config: ProjectConfigSnapshot
  /** Wallet address + chain — if present, Claude receives blockchain tools */
  walletConfig?: { address: string; chainId: string } | null
  ragContext?: string
  mode?: "support" | "token"
  tokenModeAsk?: string | null
  persona?: string | null
  language?: string | null
  customTone?: string | null
  /**
   * The user's protocol account (subaccount), when this protocol keeps funds in
   * a per-user account object rather than the wallet. Resolved BEFORE the first
   * message so the model knows the user has two identities rather than
   * discovering it mid-conversation, which is how it ends up telling a user
   * their own address is not theirs.
   */
  /**
   * The protocol's own status notice, when one is live. Rendered ABOVE the
   * documentation and declared to outrank it, because the docs are yesterday's
   * truth and this is today's.
   */
  statusNotice?: { level: string; message: string; topics?: string[] } | null
  /**
   * A beta programme is running. Changes what the assistant is FOR: the people
   * asking are testers, and some of what they say is feedback rather than a
   * question. Layered on top of support mode, never instead of it.
   */
  beta?: { feedback: boolean; bugs: boolean } | null
  protocolAccount?: ProtocolAccountContext | null
  /**
   * Omit the retrieved-docs section from the prompt so the caller can place it
   * after the prompt-cache breakpoint. Docs change per question; leaving them
   * inline makes the entire prefix per-question and defeats caching.
   */
  docsSeparate?: boolean
  /**
   * On-chain diagnosis for this project. `false` turns it OFF: the assistant
   * answers from the documentation and records bug reports, but must NEVER look
   * up or debug a transaction. A protocol that opted out of diagnosis (a wrong
   * debug suggestion is a risk they will not carry) needs that to be
   * mechanically impossible, not merely discouraged, so this both strips the
   * on-chain tools (see stream.ts) and swaps the prompt to refuse. Undefined or
   * true keeps the full diagnostic agent.
   */
  diagnostics?: boolean
}
