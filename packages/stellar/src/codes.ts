import { CODE_NAMES, OPERATION_TYPES, RESULT_CODE_ENUM_FOR_OP, SUCCESS_PAYLOAD_BYTES } from "./codes.generated"

export { CODE_NAMES, OPERATION_TYPES, RESULT_CODE_ENUM_FOR_OP, SUCCESS_PAYLOAD_BYTES }

/**
 * What Stellar's result codes MEAN, in the words a user needs.
 *
 * PROVENANCE. Every name and number in codes.generated.ts was harvested
 * mechanically from Stellar's own XDR (stellar/stellar-xdr, `Stellar-transaction.x`)
 * by scripts/harvest-result-codes.ts. 208 codes across 28 enums, plus the
 * operation-to-enum mapping read out of `union OperationResult` rather than
 * derived from names, because the XDR reuses ManageSellOfferResult for
 * CREATE_PASSIVE_SELL_OFFER and spells ExtendFootprintTTLResult with TTL
 * capitalised. The mapping is Stellar's; the English below is ours;
 * codes.test.ts fails if a constant here is not in the harvest.
 *
 * THREE STELLAR CONCEPTS DO MOST OF THE WORK, and a user will not know any of
 * them, so the explanations name them rather than assuming:
 *
 *   TRUSTLINES. You cannot hold an asset on Stellar until you have explicitly
 *   trusted its issuer. "No trustline" is not a bug and not a balance problem.
 *   RESERVES. Every account must keep a minimum XLM balance, and it rises with
 *   each trustline, offer and signer. So "I have XLM" and "I have spendable
 *   XLM" are different, which is what UNDERFUNDED usually means.
 *   TIME BOUNDS. Stellar transactions carry an expiry. A wallet that took too
 *   long to submit produces txTOO_LATE, and nothing happened.
 */
export function codeName(enumName: string, value: number): string | null {
  return CODE_NAMES[enumName]?.[value] ?? null
}

/** Plain English by constant name. Absent means we hold no description, which is stated rather than guessed. */
const EXPLANATIONS: Record<string, string> = {
  // ── TransactionResultCode: the transaction never reached its operations ────
  txFAILED: "One of the operations in this transaction failed, so the whole transaction was rolled back. Stellar applies a transaction all or nothing, so nothing it set out to do took effect.",
  txTOO_EARLY: "The transaction carried a time bound that had not started yet, so the network would not apply it.",
  txTOO_LATE: "The transaction expired before it was included. Stellar transactions carry a time bound, and this one passed while it was waiting, so it was never applied and nothing moved. Submitting again is safe: the expired one cannot execute later.",
  txMISSING_OPERATION: "The transaction contained no operations, so there was nothing to apply.",
  txBAD_SEQ: "The sequence number was not the one this account expected next. That normally means two transactions were submitted from the same account at once, or one was already applied. Reloading the account and rebuilding the transaction fixes it. Nothing was applied here.",
  txBAD_AUTH: "The signatures on this transaction did not meet the account's signing requirements. Nothing was applied.",
  txINSUFFICIENT_BALANCE: "The account could not cover the fee while keeping its minimum reserve. On Stellar an account must always hold a base reserve plus an amount for each trustline, offer and signer, so an account can show a balance and still be unable to spend it.",
  txNO_ACCOUNT: "The source account does not exist on the ledger. A Stellar account has to be created and funded before it can send anything.",
  txINSUFFICIENT_FEE: "The fee offered was below what the network was accepting when this was submitted. Stellar prices by surge when a ledger is full, so a fee that works normally can be too low for a busy ledger. Nothing was applied, and resubmitting with a higher fee is the fix.",
  txBAD_AUTH_EXTRA: "The transaction carried a signature that was not needed. Nothing was applied.",
  txINTERNAL_ERROR: "The network reported an internal error applying this transaction. Nothing was applied.",
  txNOT_SUPPORTED: "The network does not support this transaction as built.",
  txFEE_BUMP_INNER_FAILED: "This was a fee bump transaction, and the inner transaction it was paying for is the one that failed. The fee bump itself was fine, so look at the inner transaction's own result for the reason.",
  txBAD_SPONSORSHIP: "The sponsorship arrangement in this transaction was not valid.",
  txBAD_MIN_SEQ_AGE_OR_GAP: "The transaction's minimum sequence age or gap precondition was not met yet.",
  txMALFORMED: "The transaction was not well formed, so the network rejected it without applying anything.",
  txSOROBAN_INVALID: "The Soroban resources declared by this transaction were not valid, so it was rejected before running.",
  txFROZEN_KEY_ACCESSED: "The transaction touched an account key that is frozen.",

  // ── OperationResultCode: the outer wrapper on a single operation ───────────
  opBAD_AUTH: "This operation was not authorised by enough signatures.",
  opNO_ACCOUNT: "The account this operation was sourced from does not exist on the ledger.",
  opNOT_SUPPORTED: "The network does not support this operation.",
  opTOO_MANY_SUBENTRIES: "The account already holds the maximum number of subentries (trustlines, offers, signers and data entries), so another could not be added.",
  opEXCEEDED_WORK_LIMIT: "The operation exceeded the work the network will do for one operation.",
  opTOO_MANY_SPONSORING: "The account is already sponsoring the maximum number of entries.",

  // ── Path payments: 66% of every failure observed on mainnet ───────────────
  PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN: "The swap would have delivered less than the minimum you set, so Stellar refused it rather than filling at a worse rate. That minimum is your slippage protection doing its job: the price along the path moved between the quote and the transaction being applied. Nothing was swapped and only the fee was spent.",
  PATH_PAYMENT_STRICT_RECEIVE_OVER_SENDMAX: "The swap would have cost more than the maximum you set, so Stellar refused it rather than spending more than you allowed. That maximum is your slippage protection doing its job: the price along the path moved between the quote and the transaction being applied. Nothing was swapped and only the fee was spent.",
  PATH_PAYMENT_STRICT_SEND_TOO_FEW_OFFERS: "There was not enough liquidity along any path to complete this swap. Nothing was swapped.",
  PATH_PAYMENT_STRICT_RECEIVE_TOO_FEW_OFFERS: "There was not enough liquidity along any path to complete this swap. Nothing was swapped.",
  PATH_PAYMENT_STRICT_SEND_UNDERFUNDED: "The sending account did not hold enough of the asset being sent. On Stellar this includes the reserve: an account must keep a minimum XLM balance plus an amount for each trustline, offer and signer, so a visible balance is not always a spendable one.",
  PATH_PAYMENT_STRICT_RECEIVE_UNDERFUNDED: "The sending account did not hold enough of the asset being sent. On Stellar this includes the reserve: an account must keep a minimum XLM balance plus an amount for each trustline, offer and signer, so a visible balance is not always a spendable one.",
  PATH_PAYMENT_STRICT_SEND_NO_TRUST: "The destination has no trustline for the asset being delivered. On Stellar an account has to explicitly trust an asset before it can receive it, so this is something the recipient sets up, not a problem with the payment.",
  PATH_PAYMENT_STRICT_RECEIVE_NO_TRUST: "The destination has no trustline for the asset being delivered. On Stellar an account has to explicitly trust an asset before it can receive it, so this is something the recipient sets up, not a problem with the payment.",
  PATH_PAYMENT_STRICT_SEND_SRC_NO_TRUST: "The sending account has no trustline for the asset it tried to send, so it cannot hold or send it.",
  PATH_PAYMENT_STRICT_RECEIVE_SRC_NO_TRUST: "The sending account has no trustline for the asset it tried to send, so it cannot hold or send it.",
  PATH_PAYMENT_STRICT_SEND_LINE_FULL: "The destination's trustline for this asset has a limit, and this payment would have taken it over. The recipient sets that limit and can raise it.",
  PATH_PAYMENT_STRICT_RECEIVE_LINE_FULL: "The destination's trustline for this asset has a limit, and this payment would have taken it over. The recipient sets that limit and can raise it.",
  PATH_PAYMENT_STRICT_SEND_NO_DESTINATION: "The destination account does not exist on the ledger. A Stellar account has to be created before it can be paid.",
  PATH_PAYMENT_STRICT_RECEIVE_NO_DESTINATION: "The destination account does not exist on the ledger. A Stellar account has to be created before it can be paid.",
  PATH_PAYMENT_STRICT_SEND_OFFER_CROSS_SELF: "The path would have matched against this account's own offer, which Stellar does not allow.",
  PATH_PAYMENT_STRICT_RECEIVE_OFFER_CROSS_SELF: "The path would have matched against this account's own offer, which Stellar does not allow.",
  PATH_PAYMENT_STRICT_SEND_NOT_AUTHORIZED: "The destination is not authorised by the asset's issuer to hold it. Some issuers require approval per account.",
  PATH_PAYMENT_STRICT_RECEIVE_NOT_AUTHORIZED: "The destination is not authorised by the asset's issuer to hold it. Some issuers require approval per account.",
  PATH_PAYMENT_STRICT_SEND_SRC_NOT_AUTHORIZED: "The sending account is not authorised by the asset's issuer to send it.",
  PATH_PAYMENT_STRICT_RECEIVE_SRC_NOT_AUTHORIZED: "The sending account is not authorised by the asset's issuer to send it.",
  PATH_PAYMENT_STRICT_SEND_NO_ISSUER: "An asset on the path has no issuer account on the ledger.",
  PATH_PAYMENT_STRICT_RECEIVE_NO_ISSUER: "An asset on the path has no issuer account on the ledger.",
  PATH_PAYMENT_STRICT_SEND_MALFORMED: "The swap was not well formed, for example a non-positive amount or an invalid asset.",
  PATH_PAYMENT_STRICT_RECEIVE_MALFORMED: "The swap was not well formed, for example a non-positive amount or an invalid asset.",

  // ── Payments and account setup ────────────────────────────────────────────
  PAYMENT_UNDERFUNDED: "The account did not hold enough of this asset to send that amount. On Stellar the reserve counts against you: an account must keep a minimum XLM balance plus an amount for each trustline, offer and signer, so the spendable balance is lower than the one displayed.",
  PAYMENT_NO_TRUST: "The destination has no trustline for this asset. On Stellar an account has to explicitly trust an asset before it can receive it, so the recipient sets this up.",
  PAYMENT_SRC_NO_TRUST: "The sending account has no trustline for this asset, so it cannot send it.",
  PAYMENT_NO_DESTINATION: "The destination account does not exist on the ledger. A Stellar account has to be created and funded before it can be paid.",
  PAYMENT_LINE_FULL: "The destination's trustline for this asset has a limit, and this payment would have taken it over.",
  PAYMENT_NOT_AUTHORIZED: "The destination is not authorised by the asset's issuer to hold it.",
  PAYMENT_SRC_NOT_AUTHORIZED: "The sending account is not authorised by the asset's issuer to send it.",
  PAYMENT_NO_ISSUER: "This asset's issuer account does not exist on the ledger.",
  PAYMENT_MALFORMED: "The payment was not well formed, for example a non-positive amount or an invalid asset.",
  CREATE_ACCOUNT_UNDERFUNDED: "The funding account did not have enough XLM to create the new account with its minimum starting balance.",
  CREATE_ACCOUNT_LOW_RESERVE: "The starting balance was below the minimum a new Stellar account must hold.",
  CREATE_ACCOUNT_ALREADY_EXIST: "That account already exists on the ledger, so it could not be created again.",
  CREATE_ACCOUNT_MALFORMED: "The destination given was not a valid account address.",

  // ── Account options ───────────────────────────────────────────────────────
  SET_OPTIONS_LOW_RESERVE: "This change would take the account below its minimum reserve. Adding a signer raises the XLM an account must keep, so more XLM is needed first.",
  SET_OPTIONS_TOO_MANY_SIGNERS: "The account already has the maximum number of signers.",
  SET_OPTIONS_BAD_FLAGS: "The combination of account flags requested is not valid.",
  SET_OPTIONS_INVALID_INFLATION: "The inflation destination given does not exist.",
  SET_OPTIONS_CANT_CHANGE: "This account is marked immutable, so its options cannot be changed.",
  SET_OPTIONS_UNKNOWN_FLAG: "One of the account flags requested is not one Stellar recognises.",
  SET_OPTIONS_THRESHOLD_OUT_OF_RANGE: "A signing threshold given was outside the range Stellar allows.",
  SET_OPTIONS_BAD_SIGNER: "The signer given was not valid.",
  SET_OPTIONS_INVALID_HOME_DOMAIN: "The home domain given was not a valid domain.",
  SET_OPTIONS_AUTH_REVOCABLE_REQUIRED: "This change needs the account's auth revocable flag set first.",

  // ── Trustlines ────────────────────────────────────────────────────────────
  CHANGE_TRUST_LOW_RESERVE: "Adding this trustline would take the account below its minimum reserve. Each trustline raises the XLM an account must keep, so more XLM is needed before it can be added.",
  CHANGE_TRUST_INVALID_LIMIT: "The trustline limit given was not valid, for example lower than the balance already held.",
  CHANGE_TRUST_NO_ISSUER: "The issuer of this asset does not exist on the ledger.",
  CHANGE_TRUST_SELF_NOT_ALLOWED: "An account cannot create a trustline to an asset it issues itself.",
  CHANGE_TRUST_TRUST_LINE_MISSING: "There is no trustline to change.",
  CHANGE_TRUST_CANNOT_DELETE: "The trustline still holds a balance or is in use, so it cannot be removed yet.",
  CHANGE_TRUST_NOT_AUTH_MAINTAIN_LIABILITIES: "The issuer has not authorised this account to maintain liabilities on the asset.",
  SET_TRUST_LINE_FLAGS_MALFORMED: "The trustline flags requested were not valid.",
  SET_TRUST_LINE_FLAGS_NO_TRUST_LINE: "There is no trustline between that account and this asset, so its flags could not be set.",
  SET_TRUST_LINE_FLAGS_CANT_REVOKE: "The issuer has given up the ability to revoke authorisation on this asset, so the flag cannot be cleared.",
  SET_TRUST_LINE_FLAGS_INVALID_STATE: "The combination of trustline flags requested is not a valid state.",
  SET_TRUST_LINE_FLAGS_LOW_RESERVE: "Applying these flags would take an account below its minimum reserve.",

  // ── Orderbook offers ──────────────────────────────────────────────────────
  MANAGE_SELL_OFFER_UNDERFUNDED: "The account does not hold enough of the asset it offered to sell, once the reserve is taken into account.",
  MANAGE_BUY_OFFER_UNDERFUNDED: "The account does not hold enough of the asset it offered to pay with, once the reserve is taken into account.",
  MANAGE_SELL_OFFER_LINE_FULL: "Filling this offer would take the account past the limit on its trustline for the asset it would receive.",
  MANAGE_BUY_OFFER_LINE_FULL: "Filling this offer would take the account past the limit on its trustline for the asset it would receive.",
  MANAGE_SELL_OFFER_CROSS_SELF: "This offer would have matched against the account's own existing offer, which Stellar does not allow.",
  MANAGE_BUY_OFFER_CROSS_SELF: "This offer would have matched against the account's own existing offer, which Stellar does not allow.",
  MANAGE_SELL_OFFER_LOW_RESERVE: "Keeping this offer on the book would take the account below its minimum reserve. Each open offer raises the XLM an account must hold.",
  MANAGE_BUY_OFFER_LOW_RESERVE: "Keeping this offer on the book would take the account below its minimum reserve. Each open offer raises the XLM an account must hold.",
  MANAGE_SELL_OFFER_NOT_FOUND: "The offer this was trying to change or cancel is no longer on the book. It may already have been filled or cancelled.",
  MANAGE_BUY_OFFER_NOT_FOUND: "The offer this was trying to change or cancel is no longer on the book. It may already have been filled or cancelled.",
  MANAGE_SELL_OFFER_SELL_NO_TRUST: "The account has no trustline for the asset it offered to sell.",
  MANAGE_BUY_OFFER_SELL_NO_TRUST: "The account has no trustline for the asset it offered to sell.",
  MANAGE_SELL_OFFER_BUY_NO_TRUST: "The account has no trustline for the asset it offered to buy, so it could not receive it.",
  MANAGE_BUY_OFFER_BUY_NO_TRUST: "The account has no trustline for the asset it offered to buy, so it could not receive it.",
  MANAGE_SELL_OFFER_MALFORMED: "The offer was not well formed, for example a non-positive amount or an invalid price.",
  MANAGE_BUY_OFFER_MALFORMED: "The offer was not well formed, for example a non-positive amount or an invalid price.",

  // ── Claimable balances ────────────────────────────────────────────────────
  CREATE_CLAIMABLE_BALANCE_LOW_RESERVE: "Creating this claimable balance would take the account below its minimum reserve.",
  CREATE_CLAIMABLE_BALANCE_UNDERFUNDED: "The account did not hold enough of the asset to put into the claimable balance.",
  CREATE_CLAIMABLE_BALANCE_NO_TRUST: "The account has no trustline for the asset it tried to lock into a claimable balance.",
  CREATE_CLAIMABLE_BALANCE_MALFORMED: "The claimable balance was not well formed, for example an invalid amount or claimant.",
  CREATE_CLAIMABLE_BALANCE_NOT_AUTHORIZED: "The account is not authorised by the issuer to hold this asset.",
  CLAIM_CLAIMABLE_BALANCE_DOES_NOT_EXIST: "There is no claimable balance with that identifier. It may already have been claimed.",
  CLAIM_CLAIMABLE_BALANCE_CANNOT_CLAIM: "This account is not able to claim that balance right now. A claimable balance carries conditions, most often a time window, and they were not met.",
  CLAIM_CLAIMABLE_BALANCE_LINE_FULL: "Claiming this would take the account past the limit on its trustline for the asset.",
  CLAIM_CLAIMABLE_BALANCE_NO_TRUST: "The account has no trustline for the asset in this claimable balance, so it cannot receive it.",
  CLAIM_CLAIMABLE_BALANCE_NOT_AUTHORIZED: "The account is not authorised by the issuer to hold this asset.",

  // ── Soroban ───────────────────────────────────────────────────────────────
  INVOKE_HOST_FUNCTION_MALFORMED: "The contract call was not well formed.",
  INVOKE_HOST_FUNCTION_TRAPPED: "The contract stopped partway through and rejected the call. The reason is defined by the contract rather than by Stellar, so what it means depends on the protocol. Nothing the transaction set out to do took effect.",
  INVOKE_HOST_FUNCTION_RESOURCE_LIMIT_EXCEEDED: "The contract call needed more resources than the transaction reserved for it. On Soroban a transaction declares its resource budget up front, so this is a budget set too low rather than an account short of funds.",
  INVOKE_HOST_FUNCTION_ENTRY_ARCHIVED: "The contract data this call needed has been archived. Soroban expires state that has not been used, and it has to be restored before the contract can run again.",
  INVOKE_HOST_FUNCTION_INSUFFICIENT_REFUNDABLE_FEE: "The refundable portion of the fee was not enough to cover the contract's rent and events.",

  // ── Liquidity pools ───────────────────────────────────────────────────────
  LIQUIDITY_POOL_DEPOSIT_UNDERFUNDED: "The account did not hold enough of one of the two assets to make this deposit.",
  LIQUIDITY_POOL_DEPOSIT_BAD_PRICE: "The pool's price moved outside the range this deposit allowed, so it was refused rather than filled at a worse rate.",
  LIQUIDITY_POOL_DEPOSIT_LINE_FULL: "The pool share trustline has a limit and this deposit would have taken it over.",
  LIQUIDITY_POOL_DEPOSIT_NO_TRUST: "The account has no trustline for the pool shares or for one of the pool's assets.",
  LIQUIDITY_POOL_DEPOSIT_POOL_FULL: "The pool has reached the maximum it can hold.",
  LIQUIDITY_POOL_WITHDRAW_UNDERFUNDED: "The account does not hold that many pool shares.",
  LIQUIDITY_POOL_WITHDRAW_UNDER_MINIMUM: "The withdrawal would have returned less than the minimum set, so it was refused. The pool's composition moved between the quote and the transaction being applied.",
  LIQUIDITY_POOL_WITHDRAW_LINE_FULL: "Withdrawing would take a trustline past its limit.",
  LIQUIDITY_POOL_WITHDRAW_NO_TRUST: "The account has no trustline for one of the assets it would receive.",

  // ── Account merge ─────────────────────────────────────────────────────────
  ACCOUNT_MERGE_HAS_SUB_ENTRIES: "The account still has trustlines, offers, signers or data entries, and all of those have to be removed before it can be merged away.",
  ACCOUNT_MERGE_NO_ACCOUNT: "The destination account does not exist on the ledger.",
  ACCOUNT_MERGE_DEST_FULL: "Merging would take the destination account past the maximum balance it can hold.",
  ACCOUNT_MERGE_IMMUTABLE_SET: "This account is marked immutable, so it cannot be merged away.",
  ACCOUNT_MERGE_SEQNUM_TOO_FAR: "The account's sequence number is too far ahead for it to be merged.",
  ACCOUNT_MERGE_IS_SPONSOR: "The account is sponsoring entries for others, so it cannot be merged away yet.",
  ACCOUNT_MERGE_MALFORMED: "The merge was not well formed, for example merging an account into itself.",
}

/**
 * What to tell a user about one code, or null when we hold no description.
 *
 * NULL IS A REAL ANSWER AND MUST STAY ONE. Stellar defines 208 codes; we have
 * English for the ones that occur and the ones a user could plausibly hit. For
 * the rest the honest output is the operation, the constant name and the number,
 * which the caller builds, rather than a sentence invented from the name.
 */
export function explain(constant: string | null): string | null {
  if (!constant) return null
  return EXPLANATIONS[constant] ?? null
}

/** Every constant we hold English for, so a test can check it against the harvest. */
export const EXPLAINED_CONSTANTS = Object.keys(EXPLANATIONS)
