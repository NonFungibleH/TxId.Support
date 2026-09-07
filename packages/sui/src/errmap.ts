import type { SuiErrmap } from "./abort"

/**
 * Sui error maps, and the one structural fact that makes them different.
 *
 * A SUI PACKAGE UPGRADE PUBLISHES A NEW ADDRESS. The abort reports whichever
 * runtime address executed, so a map keyed on the address you saw today is
 * already wrong for two of the three DeepBook versions live on mainnet right
 * now (0x0e735f8c, 0xb29d83c2 and 0xcaf6ba05 all appeared in a single
 * 150-checkpoint window on 2026-09-07) and is wrong for ALL of them the day
 * after the next upgrade.
 *
 * So the key is the ORIGINAL package id, the address the package was first
 * published at, which never moves. `resolveOriginalPackage` in package.ts gets
 * from a runtime address to that one, and every entry below is keyed on it.
 *
 * PROVENANCE. Sui puts no constant name in the abort and no constants field on
 * sui_getNormalizedMoveModule, so unlike Aptos there is no on-chain route to
 * the meaning of a code. Every name and number here was harvested mechanically
 * from the protocol's published Move source by scripts/harvest-deepbook.ts,
 * checked in as scripts/deepbook-errors.json, and errmap.test.ts fails if this
 * file drifts from it. The ENGLISH is ours; the mapping is theirs.
 */

/** DeepBook v3, Mysten's own central limit orderbook. Original package id. */
export const DEEPBOOK_PACKAGE =
  "0x2c8d603bc51326b8c13cef9dd07031a408a48dddb541963357661df5d3204809"

/**
 * An invariant inside DeepBook's own data structures. Nothing the user did
 * causes these, and telling somebody to "check their inputs" would send them
 * looking for a mistake they did not make.
 */
const internal = (name: string, what: string) => ({
  name,
  reason: `DeepBook stopped on an internal check (${what}). This is a condition inside DeepBook's own bookkeeping rather than anything wrong with your order, so retrying the same request is unlikely to change the outcome. Nothing was completed and only the gas was spent.`,
})

const DEEPBOOK: Record<string, Record<number, { name: string; reason: string }>> = {
  balance_manager: {
    0: { name: "EInvalidOwner", reason: "The balance manager this transaction used is not owned by the address that signed it. A balance manager belongs to one owner, and only that owner can act on it directly." },
    1: { name: "EInvalidTrader", reason: "The address that signed is not a trader authorised on this balance manager. The owner grants trading rights explicitly, and this address does not currently hold them." },
    2: { name: "EInvalidProof", reason: "The trade proof presented with this transaction was not valid for the balance manager it was used against. A proof is generated for one balance manager and one purpose, so this usually means the wrong one was attached." },
    3: { name: "EBalanceManagerBalanceTooLow", reason: "The withdrawal asked for more than the balance manager holds of that coin. Funds in DeepBook sit inside your balance manager rather than in your wallet, and settled trades or open orders can hold part of it, so the amount available to withdraw is not always the amount you deposited." },
    4: { name: "EMaxCapsReached", reason: "This balance manager already has the maximum number of capabilities issued against it, so another could not be added. An existing one has to be revoked first." },
    5: { name: "ECapNotInList", reason: "The capability this transaction tried to use or revoke is not registered on this balance manager. It may already have been revoked." },
    6: { name: "EInvalidReferralOwner", reason: "The referral used does not belong to the address that signed this transaction." },
  },
  order_info: {
    0: { name: "EOrderInvalidPrice", reason: "The order price sits outside the range the pool accepts, or is not a whole number of ticks. Every DeepBook pool has a tick size, and a price between ticks cannot be placed." },
    1: { name: "EOrderBelowMinimumSize", reason: "The order is smaller than the pool's minimum size. Each pool sets its own floor, and an order under it is rejected rather than rounded up." },
    2: { name: "EOrderInvalidLotSize", reason: "The order quantity is not a whole number of lots. Every pool has a lot size, and quantities have to be a multiple of it." },
    3: { name: "EInvalidExpireTimestamp", reason: "The expiry given for this order is already in the past. An order cannot be placed with an expiry that has passed." },
    4: { name: "EInvalidOrderType", reason: "The order type sent is not one this pool accepts." },
    5: { name: "EPOSTOrderCrossesOrderbook", reason: "This was a post-only order and it would have matched against an order already resting on the book. Post-only exists to guarantee you add liquidity rather than take it, so instead of filling at a worse price it cancels. The market moved between the price being quoted and the order arriving." },
    6: { name: "EFOKOrderCannotBeFullyFilled", reason: "This was a fill-or-kill order and there was not enough resting liquidity to fill all of it at your limit price, so none of it was filled. That is the behaviour fill-or-kill asks for: all or nothing." },
    7: { name: "EMarketOrderCannotBePostOnly", reason: "The order was sent as both a market order and post-only, which contradict each other. A market order takes liquidity and post-only refuses to." },
    8: { name: "ESelfMatchingCancelTaker", reason: "This order would have matched against another of your own orders on the book, and the self-match rule chosen cancelled the incoming side. Nothing was traded with yourself." },
  },
  book: {
    1: { name: "EInvalidAmountIn", reason: "The input amount for this swap was not accepted by the pool. A swap has to name a positive quantity of one of the pool's two coins." },
    2: { name: "EEmptyOrderbook", reason: "There are no resting orders on the side of the book this order needed to match against, so there was nothing to trade with." },
    3: { name: "EInvalidPriceRange", reason: "The price range given was not valid, with the low bound above the high bound." },
    4: { name: "EInvalidTicks", reason: "The number of ticks requested was outside what the pool allows." },
    5: { name: "EOrderBelowMinimumSize", reason: "The order is smaller than the pool's minimum size. Each pool sets its own floor, and an order under it is rejected rather than rounded up." },
    6: { name: "EOrderInvalidLotSize", reason: "The order quantity is not a whole number of lots. Every pool has a lot size, and quantities have to be a multiple of it." },
    7: { name: "ENewQuantityMustBeLessThanOriginal", reason: "An order can only be modified downwards. Increasing the size means cancelling and placing a new order, which also gives up its place in the queue." },
  },
  order: {
    0: { name: "EInvalidNewQuantity", reason: "The new quantity for this modification was not valid. An order can only be reduced, and not to zero, which is a cancellation instead." },
    1: { name: "EOrderExpired", reason: "The order had already expired by the time this transaction executed, so there was nothing left to act on." },
  },
  pool: {
    1: { name: "EInvalidFee", reason: "The fee supplied for creating this pool was not the amount the registry requires." },
    2: { name: "ESameBaseAndQuote", reason: "A pool cannot be created with the same coin on both sides." },
    3: { name: "EInvalidTickSize", reason: "The tick size given for this pool is not valid." },
    4: { name: "EInvalidLotSize", reason: "The lot size given for this pool is not valid." },
    5: { name: "EInvalidMinSize", reason: "The minimum size given for this pool is not valid." },
    6: { name: "EInvalidQuantityIn", reason: "The quantity sent into this swap was not accepted. It has to be a positive amount of one of the pool's two coins." },
    7: { name: "EIneligibleReferencePool", reason: "The pool named as a price reference is not eligible to be one. DeepBook only accepts certain pools as a source of price." },
    8: { name: "EInvalidOrderBalanceManager", reason: "The balance manager presented does not match the one the order was placed with. An order can only be modified or cancelled through the balance manager that created it." },
    9: { name: "EIneligibleTargetPool", reason: "The pool named as the target of this operation is not eligible for it." },
    10: { name: "EPackageVersionDisabled", reason: "This transaction went to a version of the DeepBook package that has been turned off. That happens after an upgrade, and it means the app or SDK that built the transaction is pointing at an old address. Updating the app is the fix, and your funds are unaffected." },
    11: { name: "EMinimumQuantityOutNotMet", reason: "The swap would have returned less than the minimum you set, so it was rejected rather than filled at a worse rate. That minimum is your slippage protection doing its job. The price moved between the quote and the transaction arriving." },
    12: { name: "EInvalidStake", reason: "The stake amount is not valid for this pool." },
    13: { name: "EPoolNotRegistered", reason: "This pool is not registered with DeepBook, so it cannot be traded through." },
    14: { name: "EPoolCannotBeBothWhitelistedAndStable", reason: "A pool cannot be configured as both whitelisted and stable." },
    15: { name: "EInvalidReferralMultiplier", reason: "The referral multiplier given is outside the accepted range." },
    16: { name: "EInvalidEWMAAlpha", reason: "The smoothing parameter given for the pool's moving average is outside the accepted range." },
    17: { name: "EInvalidZScoreThreshold", reason: "The volatility threshold given for this pool is outside the accepted range." },
    18: { name: "EInvalidAdditionalTakerFee", reason: "The additional taker fee given is outside the accepted range." },
    19: { name: "EWrongPoolReferral", reason: "The referral presented belongs to a different pool from the one being traded." },
    20: { name: "EInvalidDeepPrice", reason: "The DEEP price reference this pool needs was not usable. DeepBook charges fees in DEEP and needs a price for it, and without one the trade cannot be priced." },
  },
  vault: {
    1: { name: "ENotEnoughBaseForLoan", reason: "The flash loan asked for more of the base coin than the pool's vault holds." },
    2: { name: "ENotEnoughQuoteForLoan", reason: "The flash loan asked for more of the quote coin than the pool's vault holds." },
    3: { name: "EInvalidLoanQuantity", reason: "The flash loan quantity was not valid. It has to be a positive amount." },
    4: { name: "EIncorrectLoanPool", reason: "The flash loan was repaid to a different pool from the one that issued it." },
    5: { name: "EIncorrectTypeReturned", reason: "The coin returned to close the flash loan was not the coin that was borrowed." },
    6: { name: "EIncorrectQuantityReturned", reason: "The amount returned to close the flash loan did not cover what was borrowed. A flash loan has to be repaid in full inside the same transaction, so the whole transaction is undone." },
    7: { name: "ENoBalanceToSettle", reason: "There was nothing to settle for this balance manager on this pool." },
    8: { name: "EHasOwedBalances", reason: "This operation cannot run while the balance manager still owes balances on the pool. Those have to be settled first." },
  },
  state: {
    1: { name: "ENoStake", reason: "This action needs staked DEEP on the pool and none is staked." },
    2: { name: "EMaxOpenOrders", reason: "This balance manager already has the maximum number of open orders on this pool. Cancelling or letting some fill makes room for another." },
    3: { name: "EAlreadyProposed", reason: "This balance manager has already made a governance proposal in the current epoch." },
  },
  registry: {
    1: { name: "EPoolAlreadyExists", reason: "A pool for this pair of coins already exists, so a second one cannot be created." },
    2: { name: "EPoolDoesNotExist", reason: "No pool exists for this pair of coins." },
    3: { name: "EPackageVersionNotEnabled", reason: "This transaction went to a version of the DeepBook package that is not enabled. That usually means the app or SDK that built it is pointing at an old package address. Your funds are unaffected." },
    4: { name: "EVersionNotEnabled", reason: "The package version named here is not enabled in the registry." },
    5: { name: "EVersionAlreadyEnabled", reason: "The package version named here is already enabled." },
    6: { name: "ECoinAlreadyWhitelisted", reason: "This coin is already whitelisted." },
    7: { name: "ECoinNotWhitelisted", reason: "This coin is not whitelisted, so it cannot be used where a whitelisted coin is required." },
    8: { name: "EMaxBalanceManagersReached", reason: "The maximum number of balance managers has already been reached." },
    9: { name: "EAppNotAuthorized", reason: "The app calling DeepBook here is not authorised to." },
    10: { name: "EPauseCapNotValid", reason: "The capability presented is not valid for pausing." },
  },
  governance: {
    1: { name: "EInvalidMakerFee", reason: "The maker fee in this proposal is outside the range the pool allows." },
    2: { name: "EInvalidTakerFee", reason: "The taker fee in this proposal is outside the range the pool allows." },
    3: { name: "EProposalDoesNotExist", reason: "The proposal voted on does not exist in the current epoch. Proposals do not carry over between epochs." },
    4: { name: "EMaxProposalsReachedNotEnoughVotes", reason: "The pool already has the maximum number of proposals this epoch, and this one did not have enough votes to displace one of them." },
    5: { name: "EWhitelistedPoolCannotChange", reason: "A whitelisted pool's parameters cannot be changed by governance." },
    6: { name: "EInvalidStakeRequired", reason: "The stake requirement in this proposal is outside the range the pool allows." },
  },
  deep_price: {
    1: { name: "EDataPointRecentlyAdded", reason: "A DEEP price point was added too recently for another to be accepted yet." },
    2: { name: "ENoDataPoints", reason: "There are no DEEP price points recorded for this pool, so a DEEP-denominated fee cannot be priced." },
  },
  history: {
    0: { name: "EHistoricVolumesNotFound", reason: "DeepBook holds no recorded volume for the epoch this asked about." },
  },
  math: {
    0: { name: "EInvalidPrecision", reason: internal("EInvalidPrecision", "a precision check in DeepBook's fixed point maths").reason },
  },
  big_vector: {
    0: internal("ESliceTooSmall", "an orderbook slice size below the allowed minimum"),
    1: internal("ESliceTooBig", "an orderbook slice size above the allowed maximum"),
    2: internal("EFanOutTooSmall", "an orderbook fan-out below the allowed minimum"),
    3: internal("EFanOutTooBig", "an orderbook fan-out above the allowed maximum"),
    4: internal("ENotEmpty", "an orderbook structure expected to be empty and was not"),
    5: { name: "ENotFound", reason: "The order this transaction referred to is no longer on the book. An order that has already been filled, cancelled or expired cannot be modified or cancelled again, and DeepBook has no record of it to act on. Nothing was completed and only the gas was spent." },
    6: internal("EExists", "a key that already existed in the orderbook structure"),
    7: internal("EBadRemove", "an orderbook node in an unexpected state during removal"),
    8: internal("ENotAdjacent", "two orderbook nodes whose links did not match up"),
    9: internal("EBadRedistribution", "a redistribution between orderbook nodes that would have had no effect"),
  },
  constants: {
    0: internal("EOrderInfoMismatch", "an order record that did not match its book entry"),
    1: internal("EBookOrderMismatch", "a book entry that did not match its order record"),
    2: internal("EIncorrectMidPrice", "a mid price that failed its consistency check"),
    3: internal("EIncorrectPoolId", "a pool id that did not match the one expected"),
    4: internal("EFillMismatch", "a fill that did not reconcile against its order"),
  },
}

/** Every map we hold, keyed `<original package id>::<module>`. */
export const SUI_ERRMAPS: SuiErrmap = Object.fromEntries(
  Object.entries(DEEPBOOK).map(([module, codes]) => [`${DEEPBOOK_PACKAGE}::${module}`, codes]),
)

/** Which packages we can say anything about, for callers that want to know before asking. */
export const MAPPED_SUI_PACKAGES = [DEEPBOOK_PACKAGE] as const
