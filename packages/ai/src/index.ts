export { embedText, embedBatch } from "./embed"
export { chunkText } from "./chunk"
export { retrieveContext } from "./rag"
export { buildSystemPrompt } from "./prompt"
export { streamChat, completeChat } from "./stream"
export type {
  ChatMessage,
  StreamChatParams,
  ProjectConfigSnapshot,
  TokenConfigSnapshot,
  WatchedContractSnapshot,
  RagResult,
  RagChunk,
} from "./types"
