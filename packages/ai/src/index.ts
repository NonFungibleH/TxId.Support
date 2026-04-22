export { embedText, embedBatch } from "./embed"
export { chunkText } from "./chunk"
export { retrieveContext } from "./rag"
export { buildSystemPrompt } from "./prompt"
export { streamChat, streamChatWithTools, completeChat } from "./stream"
export type { StreamEvent } from "./stream"
export { buildWalletTools, executeTool, TOOL_LABELS } from "./tools"
export type { WalletConfig } from "./tools"
export type {
  ChatMessage,
  StreamChatParams,
  ProjectConfigSnapshot,
  TokenConfigSnapshot,
  WatchedContractSnapshot,
  RagResult,
  RagChunk,
} from "./types"
