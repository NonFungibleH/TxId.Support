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
   * Omit the retrieved-docs section from the prompt so the caller can place it
   * after the prompt-cache breakpoint. Docs change per question; leaving them
   * inline makes the entire prefix per-question and defeats caching.
   */
  docsSeparate?: boolean
}
