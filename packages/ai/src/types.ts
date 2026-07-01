export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ErrorGlossaryEntry {
  error: string         // error name or revert string, e.g. "SlippageTooHigh"
  explanation: string   // plain-English explanation set by the protocol team
}

export interface WatchedContractSnapshot {
  id: string
  name: string
  address: string
  chain: string
  description: string
  errorGlossary?: ErrorGlossaryEntry[]
}

export interface TokenConfigSnapshot {
  address: string
  chain: string
  symbol: string | null
  name: string | null
  dexUrl: string | null
}

export interface ProjectConfigSnapshot {
  token: TokenConfigSnapshot | null
  watchedContracts: WatchedContractSnapshot[]
  docsUrl: string | null
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
}
