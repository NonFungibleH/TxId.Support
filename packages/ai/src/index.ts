export { embedText, embedBatch } from "./embed"
export { chunkText } from "./chunk"
export { retrieveContext } from "./rag"
export { buildSystemPrompt } from "./prompt"
export { streamChat, streamChatWithTools, completeChat } from "./stream"
export type { StreamEvent } from "./stream"
export { buildWalletTools, buildEscalationTool, executeTool, TOOL_LABELS } from "./tools"
export { generateSuggestions } from "./suggestions"
export { summarizeConversation } from "./summarize"
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
export { buildPrepareContractActionTool, buildPrepareSwapTool, executeActionTool, prepareSwap, prepareContractAction } from "./actions"
export type { ActionsContext, ActionPayload, ActionsFunctionRule, SwapParams, ContractActionParams } from "./actions"
