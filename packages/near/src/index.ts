export { getNearTransaction } from "./client"
export { getNearWalletBalance, formatNear } from "./account"
export { decodeNearError, stripPanic } from "./errors"
export { PROTOCOL_ERRORS, MAPPED_CONTRACTS } from "./errmap"
export { isNearAccount, isImplicitNearAccount, isNearTxHash, looksLikeForeignAddress } from "./address"
export { NearLookupUnavailableError } from "./lookup"
export { nearRpc, endpoints } from "./rpc"
export type { DecodedNearError, NearErrorCause } from "./errors"
export type { NearBalance, NearTokenBalance, NearTransaction } from "./types"

export function isNearChain(chainId: string): boolean {
  return chainId === "near"
}
