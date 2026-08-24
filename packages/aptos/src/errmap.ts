import type { AbortErrmap } from "./abort"
import { normalizeAptosAddress } from "./address"

/**
 * Per-protocol abort errmaps for the demo protocols: Decibel, Thala,
 * Aries Markets, Amnis Finance and PancakeSwap-Aptos.
 *
 * Provenance:
 * - PancakeSwap + Amnis publish their Move source on-chain (0x1::code::PackageRegistry),
 *   so names/codes here are harvested verbatim from `const E… : u64 = …` in that source.
 * - Thala (v1 + v2) and Aries publish NO source on-chain; their entries are
 *   hand-written for abort codes observed on real mainnet failures
 *   (see scripts/tune-diagnosis.ts), with meanings from the protocols' public
 *   GitHub interfaces and docs. Where a meaning is not certain, the reason
 *   says what is known honestly instead of overclaiming.
 *
 * Reason strings are written to be read to an end user by a support agent:
 * what happened, plus what to do next.
 */

const DECIBEL = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06"
const THALA_V1 = "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af"
const THALA_V2 = "0x007730cd28ee1cdc9e999336cbc430f99e7c44397c0aa77516f6f23a78559bb5"
const ARIES = "0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3"
const AMNIS = "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a"
const PANCAKE = "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa"

const PANCAKE_ERRMAPS: AbortErrmap = {
  [`${PANCAKE}::router`]: {
    0: {
      name: "E_OUTPUT_LESS_THAN_MIN",
      reason:
        "The swap stopped because the amount you would have received fell below the minimum your slippage setting allows. The price moved between quoting and signing. Nothing was swapped and only gas was spent. Retry the swap; if it keeps happening, raise your slippage tolerance slightly or trade a smaller amount.",
    },
    1: {
      name: "E_INPUT_MORE_THAN_MAX",
      reason:
        "The swap stopped because it would have needed more input tokens than the maximum your slippage setting allows. The price moved against you between quoting and signing. Nothing was swapped. Retry, and raise your slippage tolerance slightly if it keeps happening.",
    },
    2: {
      name: "E_INSUFFICIENT_X_AMOUNT",
      reason:
        "Adding liquidity failed because the amount of the first token in the pair would have fallen below the minimum you set. The pool's ratio shifted since the quote. Retry the deposit, or loosen the minimum amounts slightly.",
    },
    3: {
      name: "E_INSUFFICIENT_Y_AMOUNT",
      reason:
        "Adding liquidity failed because the amount of the second token in the pair would have fallen below the minimum you set. The pool's ratio shifted since the quote. Retry the deposit, or loosen the minimum amounts slightly.",
    },
    4: {
      name: "E_PAIR_NOT_CREATED",
      reason:
        "No liquidity pool exists for this token pair on PancakeSwap, so the trade has no route. Double-check both tokens are the ones you meant. If the pair genuinely has no pool, it cannot be swapped here.",
    },
  },
  [`${PANCAKE}::swap`]: {
    4: {
      name: "ERROR_INSUFFICIENT_LIQUIDITY_MINTED",
      reason:
        "The liquidity deposit was too small to mint any LP tokens. Deposit larger amounts of both tokens and retry.",
    },
    6: {
      name: "ERROR_INSUFFICIENT_AMOUNT",
      reason:
        "An amount in this operation was zero or too small for the pool to process. Check the amounts you entered and retry with larger values.",
    },
    7: {
      name: "ERROR_INSUFFICIENT_LIQUIDITY",
      reason:
        "The pool does not hold enough liquidity for this trade size. Try a smaller amount, or use a pair with deeper liquidity.",
    },
    8: {
      name: "ERROR_INVALID_AMOUNT",
      reason:
        "The amount requested is more than the pool can pay out. Reduce the amount and retry.",
    },
    9: {
      name: "ERROR_TOKENS_NOT_SORTED",
      reason:
        "The pair was called with its tokens in the wrong internal order. This is an integration bug in the app that built the transaction, not a user mistake. Report it to the site you used; the official PancakeSwap interface builds this correctly.",
    },
    10: {
      name: "ERROR_INSUFFICIENT_LIQUIDITY_BURNED",
      reason:
        "The liquidity withdrawal was too small to redeem anything from the pool. Remove a larger share of your position and retry.",
    },
    13: {
      name: "ERROR_INSUFFICIENT_OUTPUT_AMOUNT",
      reason:
        "The swap would have produced zero output tokens, usually because the trade size is far too small for this pool. Increase the amount and retry.",
    },
    14: {
      name: "ERROR_INSUFFICIENT_INPUT_AMOUNT",
      reason:
        "The swap was given a zero or too-small input amount. Enter a larger amount and retry.",
    },
    15: {
      name: "ERROR_K",
      reason:
        "The pool's invariant check failed after the swap. This usually means one of the tokens charges a fee or behaves unusually on transfer. Retry with higher slippage; if it keeps failing, that token is likely incompatible with this pool.",
    },
    // The published source assigns code 16 to BOTH ERROR_X_NOT_REGISTERED and
    // ERROR_Y_NOT_REGISTERED, so code 16 cannot say which side it was.
    16: {
      name: "ERROR_X_NOT_REGISTERED",
      reason:
        "Your wallet has not registered one of the two tokens in this pair, so it cannot hold it yet (PancakeSwap uses the same code for either token). Register the token in your wallet, or use PancakeSwap's register button for that token, then retry.",
    },
  },
  [`${PANCAKE}::swap_utils`]: {
    0: {
      name: "ERROR_INSUFFICIENT_INPUT_AMOUNT",
      reason:
        "The swap was given a zero or too-small input amount. Enter a larger amount and retry.",
    },
    1: {
      name: "ERROR_INSUFFICIENT_LIQUIDITY",
      reason:
        "The pool for this pair has no usable liquidity right now, so a price cannot be computed. Try a smaller amount or a different pair.",
    },
    2: {
      name: "ERROR_INSUFFICIENT_AMOUNT",
      reason:
        "An amount in this operation was zero or too small for the pool to process. Check the amounts you entered and retry with larger values.",
    },
    // "OUTPOT" typo is in the published on-chain source; kept verbatim so the
    // name matches what a developer would find there.
    3: {
      name: "ERROR_INSUFFICIENT_OUTPOT_AMOUNT",
      reason:
        "The swap would have produced zero output tokens, usually because the trade size is far too small for this pool. Increase the amount and retry.",
    },
    4: {
      name: "ERROR_SAME_COIN",
      reason:
        "The swap was asked to trade a token for itself. Pick two different tokens and retry.",
    },
  },
}

const AMNIS_ERRMAPS: AbortErrmap = {
  [`${AMNIS}::router`]: {
    1: {
      name: "EINSUFFICIENT_AMOUNT",
      reason:
        "The amount is below the minimum Amnis accepts for this operation, so nothing was staked or moved. Increase the amount and retry.",
    },
    2: {
      name: "EINSUFFICIENT_DEPOSIT_AMOUNT",
      reason:
        "The deposit is below the minimum deposit Amnis accepts. Deposit a slightly larger amount of APT and retry.",
    },
  },
  [`${AMNIS}::withdrawal`]: {
    1: {
      name: "ETOKEN_LOCK_NOT_EXPIRED",
      reason:
        "This withdrawal is still inside its unbonding period, so it cannot be claimed yet. Wait until the lockup shown on your withdrawal ticket ends, then claim again.",
    },
    2: {
      name: "ENOT_WITHDRAWAL_TOKEN_OWNER",
      reason:
        "The withdrawal ticket you tried to claim belongs to a different wallet. Switch to the wallet that requested the withdrawal and claim from there.",
    },
  },
  [`${AMNIS}::delegation_manager`]: {
    1: {
      name: "ESTAKE_POOL_DOES_NOT_EXIST",
      reason:
        "The stake pool this operation targets does not exist. This is a protocol configuration issue rather than a user mistake; if you hit this from the Amnis app, report it to the team.",
    },
    2: {
      name: "ESTAKE_POOL_NOT_WHITELISTED",
      reason:
        "The target stake pool is not whitelisted by Amnis. This is a protocol configuration issue rather than a user mistake; if you hit this from the Amnis app, report it to the team.",
    },
    4: {
      name: "EUNSTAKE_AMOUNT_TOO_LARGE",
      reason:
        "You tried to unstake more than is currently staked for you in this pool. Check your staked balance and retry with a smaller amount.",
    },
  },
  [`${AMNIS}::aptos_governance`]: {
    1: {
      name: "ENO_TOKENS_LOCKED",
      reason:
        "This wallet has no tokens locked for Amnis governance, so there is nothing to vote with or unlock. Lock tokens first.",
    },
    2: {
      name: "EALREADY_VOTED",
      reason:
        "This wallet has already voted on this proposal, and each wallet can vote only once. No action is needed.",
    },
    3: {
      name: "ELOCK_HAS_NOT_EXPIRED",
      reason:
        "Your governance lock has not expired yet, so the tokens cannot be unlocked. Wait until the lock period ends and try again.",
    },
    4: {
      name: "EINVALID_AMOUNT",
      reason: "The amount is zero or invalid. Enter a positive amount and retry.",
    },
  },
}

// Thala publishes no on-chain source. Entries below cover codes observed on
// real mainnet failures (tune-diagnosis.ts); meanings follow ThalaSwap's
// public interface/docs. Aptos fullnodes also surface Thala's error constant
// NAMES in vm_status (e.g. "ERR_INSUFFICIENT_OUTPUT(0x1)"), so unmapped codes
// still decode with an errorName; these entries add the support-quality reason.
const THALA_ERRMAPS: AbortErrmap = {
  [`${THALA_V1}::weighted_pool_scripts`]: {
    // Observed as ERR_INSUFFICIENT_OUTPUT(0x1) on swap_exact_in: slippage guard.
    1: {
      name: "ERR_INSUFFICIENT_OUTPUT",
      reason:
        "The swap was cancelled because the amount you would have received fell below the minimum your slippage setting allows. The pool price moved between quoting and signing. Nothing was swapped and only gas was spent. Retry the swap; if it keeps happening, raise your slippage tolerance slightly or trade a smaller amount.",
    },
    2: {
      name: "ERR_EXCESSIVE_INPUT",
      reason:
        "The swap was cancelled because it would have needed more input tokens than the maximum your slippage setting allows. The pool price moved against you. Nothing was swapped. Retry, and raise your slippage tolerance slightly if it keeps happening.",
    },
  },
  [`${THALA_V1}::stable_pool_scripts`]: {
    1: {
      name: "ERR_INSUFFICIENT_OUTPUT",
      reason:
        "The swap was cancelled because the amount you would have received fell below the minimum your slippage setting allows. The pool price moved between quoting and signing. Nothing was swapped and only gas was spent. Retry the swap; if it keeps happening, raise your slippage tolerance slightly or trade a smaller amount.",
    },
    2: {
      name: "ERR_EXCESSIVE_INPUT",
      reason:
        "The swap was cancelled because it would have needed more input tokens than the maximum your slippage setting allows. The pool price moved against you. Nothing was swapped. Retry, and raise your slippage tolerance slightly if it keeps happening.",
    },
  },
}

// Aries publishes no on-chain source either; entries cover observed codes only.
const ARIES_ERRMAPS: AbortErrmap = {}

// Decibel (perps DEX): publishes no on-chain source, but fullnodes surface its
// error constant names in vm_status with canonical 0x1::error categories
// (e.g. "EMARKET_HALTED(0x30004)"), and decodeAbort matches errmap entries by
// NAME when the numeric code is category-wrapped. Constants and meanings below
// come from Decibel's official SDK error reference
// (docs.decibel.trade/typescript-sdk/error-responses) plus observed mainnet
// failures; reasons use perp trading vocabulary (positions, TP/SL, margin).
const DECIBEL_ERRMAPS: AbortErrmap = {
  [`${DECIBEL}::position_tp_sl`]: {
    // 0x10010 observed on mainnet: EINVALID_TP_SL_ORDER_ID (invalid argument, constant 16)
    0x10010: {
      name: "EINVALID_TP_SL_ORDER_ID",
      reason:
        "The take-profit/stop-loss order id in this request does not match any live TP/SL order on the position. The order was most likely already triggered or cancelled, or it belongs to a different position. Refresh the position in the app and check its active TP/SL orders; if the order is gone from the list, there is nothing left to cancel.",
    },
  },
  [`${DECIBEL}::spot_order_public_api`]: {
    // 0x1 observed on mainnet 2026-08-24 (place_spot_bulk_order_to_subaccount):
    // the on-chain message is developer-voiced (PFS, module paths); this is
    // the same fact in trader language.
    1: {
      name: "EINSUFFICIENT_PFS_FUNDS",
      reason:
        "This spot order was rejected because the wallet's available balance is short on one side of the pair: either not enough of the asset being sold, or not enough of the quote asset to buy with. The check runs before anything is placed, so nothing was traded and only gas was spent. Top up the wallet, or reduce the order size, and retry.",
    },
  },
  [`${DECIBEL}::single_order_book`]: {
    // 0x2 observed on mainnet 2026-08-21 (cancel_order_to_subaccount):
    // fullnode names the constant EORDER_NOT_FOUND in vm_status.
    2: {
      name: "EORDER_NOT_FOUND",
      reason:
        "The order id in this cancel request does not match any live order in this market's book. The order was most likely already filled or cancelled by the time the request landed, which is common in fast markets. Refresh your open orders in the app; if the order is gone from the list, there is nothing left to cancel and no position was affected.",
    },
  },
  [`${DECIBEL}::dex_accounts`]: {
    3: {
      name: "ENOT_SUBACCOUNT_OWNER_OR_LACKS_PERP_TRADING_PERMISSIONS",
      reason:
        "The signing wallet does not own this subaccount and has not been granted trading permission on it. Switch to the wallet that owns the subaccount, or have the owner grant this wallet trading permissions, then retry.",
    },
    8: {
      name: "ESUBACCOUNT_IS_NOT_ACTIVE",
      reason:
        "This subaccount is not active, so it cannot place or cancel orders. In the app, check which subaccount you are trading from and switch to an active one.",
    },
  },
  [`${DECIBEL}::bulk_order_utils`]: {
    // Observed repeatedly on mainnet from
    // dex_accounts_entry::place_bulk_orders_to_subaccount_with_repricing.
    // The fullnode embeds the constant name, so the decoder already recovers
    // EPRICE_CROSSING; this supplies the meaning a trader can act on.
    1: {
      name: "EPRICE_CROSSING",
      reason:
        "The bulk order was rejected because its buy and sell prices cross each other: at least one bid was priced at or above one of the asks in the same submission, which would have the order trade against itself. Nothing was placed and only gas was spent. Adjust the ladder so every bid sits strictly below every ask, then resubmit. If you are using automatic repricing, the quotes most likely moved between building the order and submitting it, so rebuild from a fresh mid price.",
    },
  },
  [`${DECIBEL}::perp_engine`]: {
    4: {
      name: "EMARKET_HALTED",
      reason:
        "This market is currently halted, so orders cannot be placed or cancelled right now. This is an exchange-side pause, not a problem with your account or funds. Wait for trading to resume and retry.",
    },
  },
  [`${DECIBEL}::perp_market_config`]: {
    4: {
      name: "ESIZE_NOT_RESPECTING_MIN_SIZE",
      reason:
        "The order size is below this market's minimum order size. Increase the size to at least the market minimum and retry.",
    },
    6: {
      name: "EPRICE_NOT_RESPECTING_TICKER_SIZE",
      reason:
        "The limit price is not a multiple of this market's tick size, so the order was rejected. Round the price to the nearest valid tick and retry.",
    },
    10: {
      name: "EINVALID_PRICE",
      reason: "The order price is zero or invalid for this market. Enter a valid price and retry.",
    },
    11: {
      name: "EINVALID_SIZE",
      reason: "The order size is zero. Enter a valid size and retry.",
    },
    12: {
      name: "EORDER_SIZE_TOO_LARGE",
      reason:
        "The order's notional value (price multiplied by size) is larger than this market allows. Reduce the order size and retry.",
    },
    13: {
      name: "EPRICE_SIZES_LENGTH_MISMATCH",
      reason:
        "The bulk order's price list and size list have different lengths. This is an integration bug in the client that built the order, not a user mistake; report it to the team behind that client.",
    },
  },
  [`${DECIBEL}::clearinghouse_perp`]: {
    1: {
      name: "EINVALID_ARGUMENT",
      reason:
        "An argument in this order was invalid (for bulk orders this usually means the price and size lists do not line up). Rebuild the order in the app and retry; if it keeps happening, report it to the team.",
    },
    2: {
      name: "EINVALID_SIZE_IS_ZERO",
      reason: "The order or settlement size worked out to zero, so there was nothing to execute. Check the size and retry.",
    },
    3: {
      name: "EINVALID_SIZE_IS_TOO_LARGE",
      reason: "The order size is larger than the exchange can process. Reduce the size and retry.",
    },
    4: {
      name: "EINVALID_PRICE_IS_ZERO",
      reason: "The order price worked out to zero, which is not a valid price. Check the price and retry.",
    },
    5: {
      name: "EINVALID_PRICE_IS_TOO_LARGE",
      reason: "The order price is larger than the exchange can process. Check the price for typos and retry.",
    },
    7: {
      name: "ESELF_TRADE_NOT_ALLOWED",
      reason:
        "The order would have matched against your own resting order on the other side of the book, which Decibel does not allow. Cancel the opposing order first, or adjust the price so it does not cross your own quote.",
    },
    8: {
      name: "ENOT_REDUCE_ONLY",
      reason:
        "The order was marked reduce-only but would have increased your position instead of reducing it. A reduce-only order can only close or shrink an open position: check the order's side and size against your current position.",
    },
  },
  [`${DECIBEL}::async_matching_engine`]: {
    2: {
      name: "EINVALID_TP_SL_FOR_REDUCE_ONLY",
      reason:
        "A take-profit/stop-loss cannot be attached to a reduce-only order. Place the reduce-only order without TP/SL, or set the TP/SL on the position itself.",
    },
    3: {
      name: "EINVALID_TP_SL_WITH_TRIGGER_CONDITION",
      reason:
        "A take-profit/stop-loss cannot be combined with a stop/trigger price on the same order. Place the triggered order first, then set TP/SL on the resulting position.",
    },
    4: {
      name: "EINVALID_STOP_PRICE",
      reason:
        "The stop/trigger price on this order is invalid for the current market price, for example a stop that would trigger immediately or on the wrong side. Check the trigger side and price against the market and retry.",
    },
  },
  [`${DECIBEL}::pending_order_tracker`]: {
    2: {
      name: "E_MARKET_NOT_FOUND",
      reason:
        "The cancel request referenced a market where this subaccount has no pending orders. The order may have already filled or been cancelled: refresh your open orders before retrying.",
    },
    5: {
      name: "E_INVALID_REDUCE_ONLY_ORDER",
      reason:
        "The reduce-only order is invalid against your current position, usually because the position is already closed or smaller than the order size. Refresh the position and adjust the order.",
    },
    8: {
      name: "EMAX_FIXED_SIZED_PENDING_REQS_HIT",
      reason:
        "This subaccount already has the maximum number of pending requests, so new ones are rejected until some settle or are cancelled. Cancel pending orders you no longer need, or wait a moment for the queue to clear.",
    },
    10: {
      name: "EINVALID_TP_SL_SIZE",
      reason:
        "The take-profit/stop-loss size is invalid for the position (zero, or larger than the position). Adjust the TP/SL size to at most the open position size.",
    },
  },
  [`${DECIBEL}::tp_sl_utils`]: {
    1: {
      name: "EINVALID_TP_SL_PARAMETERS",
      reason:
        "The take-profit/stop-loss parameters are invalid, usually a TP or SL price on the wrong side of the current price. For a long, take-profit must be above and stop-loss below the price (reversed for a short). Fix the prices and retry.",
    },
  },
  [`${DECIBEL}::builder_code_registry`]: {
    1: {
      name: "EINVALID_AMOUNT",
      reason:
        "The builder fee on this order is zero or negative, which is not valid. This comes from the app that routed your order; retry from the official interface or report it to that app's team.",
    },
    2: {
      name: "EBUILDER_NOT_REGISTERED",
      reason:
        "The builder code attached to this order is not registered with Decibel. This is an integration issue with the app that routed your order, not your account; report it to that app's team or trade from the official interface.",
    },
    4: {
      name: "EINVALID_MAX_FEE",
      reason:
        "The builder fee on this order exceeds the maximum fee you approved for that app. Review the app's fee settings, or approve a higher maximum builder fee if you trust it.",
    },
  },
  [`${DECIBEL}::order_placement_utils`]: {
    1: {
      name: "EINVALID_MATCH_COUNT",
      reason:
        "The order failed an internal match-count check in the matching engine. This is a protocol-side condition rather than something you did wrong. Retry the order; if it keeps failing, report it to the team.",
    },
  },
}

/** Merged errmap across the demo protocols. Keys are `address::module`. */
export const PROTOCOL_ERRMAPS: AbortErrmap = {
  ...DECIBEL_ERRMAPS,
  ...PANCAKE_ERRMAPS,
  ...AMNIS_ERRMAPS,
  ...THALA_ERRMAPS,
  ...ARIES_ERRMAPS,
}

/**
 * The protocol errmap entries relevant to a set of watched contracts: the
 * union of PROTOCOL_ERRMAPS entries whose module address matches a watched
 * Aptos contract (address comparison is normalized, "0x1" == zero-padded).
 *
 * Framework coverage (0x1::coin etc.) is NOT included here on purpose:
 * decodeAbort always applies its built-in framework table in addition to
 * whatever errmap it is given, so callers get framework decoding for free.
 *
 * Pure and synchronous: safe to call per tool invocation.
 */
export function errmapFor(watchedContracts: readonly { address: string; chain: string }[]): AbortErrmap {
  const watched = new Set(
    watchedContracts.filter(c => c.chain === "aptos").map(c => normalizeAptosAddress(c.address))
  )
  if (watched.size === 0) return {}
  const out: AbortErrmap = {}
  for (const [key, codes] of Object.entries(PROTOCOL_ERRMAPS)) {
    const sep = key.indexOf("::")
    if (sep === -1) continue
    if (watched.has(normalizeAptosAddress(key.slice(0, sep)))) out[key] = codes
  }
  return out
}
