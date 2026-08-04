export { embedText, embedBatch } from "./embed"
export { chunkText } from "./chunk"
export { retrieveContext } from "./rag"
export { buildSystemPrompt, buildDocsBlock } from "./prompt"
export { mergeToolEvidence, toolEvidenceFrom, type ToolEvidence } from "./evidence"
export { streamChat, streamChatWithTools, completeChat, completeChatWithUsage, completeChatWithToolsUsage } from "./stream"
export type { StreamEvent } from "./stream"
export { buildWalletTools, buildEscalationTool, executeTool, TOOL_LABELS } from "./tools"
export { generateSuggestions } from "./suggestions"
export type { WalletConfig } from "./tools"
export type {
  ChatMessage,
  StreamChatParams,
  ProtocolAccountContext,
  ProjectConfigSnapshot,
  TokenConfigSnapshot,
  WatchedContractSnapshot,
  RagResult,
  RagChunk,
} from "./types"
export { buildPrepareContractActionTool, buildPrepareSwapTool, executeActionTool, prepareSwap, prepareContractAction } from "./actions"
export type { ActionsContext, ActionPayload, ActionsFunctionRule, SwapParams, ContractActionParams } from "./actions"
