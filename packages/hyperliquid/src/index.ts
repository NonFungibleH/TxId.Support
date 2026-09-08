export { getHyperliquidAccount, getHyperliquidFills, getHyperliquidOrders, isHyperliquidAddress } from "./client"
export { info } from "./rpc"
export { KNOWN_STATUSES, explainStatus, isFailure } from "./statuses"
export type { StatusKind, StatusMeaning } from "./statuses"
export type {
  HyperliquidAccount, HyperliquidFill, HyperliquidLookup, HyperliquidOrder, HyperliquidPosition,
} from "./types"

/** Chain id string. HyperCore is not a chain, but it is a venue the agent reads like one. */
export function isHyperliquidChain(chainId: string): boolean {
  return chainId === "hyperliquid"
}
