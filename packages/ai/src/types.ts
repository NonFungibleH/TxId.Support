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
  protocolAccount?: ProtocolAccountContext | null
  /**
   * Omit the retrieved-docs section from the prompt so the caller can place it
   * after the prompt-cache breakpoint. Docs change per question; leaving them
   * inline makes the entire prefix per-question and defeats caching.
   */
  docsSeparate?: boolean
}
