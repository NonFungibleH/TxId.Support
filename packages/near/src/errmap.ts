/**
 * Plain English for protocol errors we have HELD A REAL PAYLOAD FOR.
 *
 * PROVENANCE IS WEAKER HERE THAN ON SUI, AND THAT MATTERS. DeepBook's map was
 * harvested mechanically from Mysten's published Move source, with the harvest
 * checked in as evidence and a drift test that fails if the two disagree. Ref
 * Finance's contracts are not reachable without a GitHub token, so this map is
 * built from FAILURES OBSERVED LIVE plus what the message itself states.
 *
 * The practical consequence: every entry here is keyed on a code we have
 * actually seen returned, and its English says only what the contract's own
 * message already says, in words a user can act on. Nothing is extrapolated
 * from a code's neighbours, and no code is listed because a table somewhere
 * says it exists. If a Ref error we have never observed arrives, it takes the
 * honest middle in errors.ts and the user is shown the contract's own sentence.
 *
 * Keyed by CONTRACT ACCOUNT, because a code is only meaningful within the
 * contract that defined it: E68 is Ref's, and means nothing anywhere else.
 *
 * Observed 2026-09-08: E68 accounted for 21 of 40 live failures, 52%.
 */
export const PROTOCOL_ERRORS: Record<string, Record<string, string>> = {
  "v2.ref-finance.near": {
    // Observed 21 times in a single 40-failure window, the largest single
    // cause of failure on NEAR in that sample.
    E68: "The price moved between the swap being quoted and it reaching the pool, by more than the slippage the swap allowed. Ref refuses rather than filling at a worse rate than agreed. Nothing was traded, only the gas was spent, and trying again with a slightly higher slippage tolerance, or a smaller size, usually goes through.",
    // The message Ref returns when the pool cannot cover the output leg.
    E76: "The pool did not hold enough of the token being bought to complete this swap at the size requested. A smaller amount, or a different route, will usually go through.",
  },
  "intents.near": {
    // Observed live; the contract's own wording is already plain, so this adds
    // only what it means for the user rather than restating it.
    "invalid intent": "The intent this transaction carried was not one the contract would accept, usually because it had already been used, had expired, or was signed for different terms than the ones submitted. Nothing was executed.",
    "insufficient balance or overflow": "The account did not hold enough of the token this intent was going to spend, or the amounts involved were too large to process. Nothing was executed.",
  },
}

/** Every contract we hold wording for, so a test can check the map against what is observed. */
export const MAPPED_CONTRACTS = Object.keys(PROTOCOL_ERRORS)
