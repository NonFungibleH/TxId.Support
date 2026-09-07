/**
 * Harvested from live mainnet, not written by hand.
 *
 * Anchor programs PRINT their own error name and message when they fail:
 *   "Error Code: ExceededSlippage. Error Number: 6004. Error Message: …"
 * so sampling enough failures harvests the map, the same way reading published
 * Move source does on Aptos. Every entry below was OBSERVED, never asserted.
 *
 * Regenerate: tsx scripts/harvest-errors.ts  (runs accumulate into
 * scripts/harvested-errors.json), then scripts/build-errmap.ts.
 *
 * Harvested 2026-09-07 from 57,095 transactions across 45 slots
 * (7,600 failures, a 13.3% failure rate). 54 definitions from 39 programs.
 *
 * WHY THIS EXISTS WHEN THE DECODER ALREADY READS THE ANCHOR LOG: the log is
 * only present on about 11% of failures. The same program hitting the same code
 * without printing it gets nothing. This map carries the answer across.
 *
 * Reason strings are the program's OWN message, except the slippage family,
 * which is 60% of everything harvested and where "ExceededSlippage" tells a
 * user nothing about what to do.
 */
export interface SolanaErrorEntry { name: string; reason: string }

export const PROGRAM_ERRMAPS: Record<string, Record<number, SolanaErrorEntry>> = {
  // seen 274x
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA": {
    3012: { name: "AccountNotInitialized", reason: "The program expected this account to be already initialized." },
    6001: { name: "ZeroBaseAmount", reason: "Zero Base Amount." },
    6004: { name: "ExceededSlippage", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
    6009: { name: "InvalidQuoteMint", reason: "Invalid Quote Mint." },
    6040: { name: "BuySlippageBelowMinBaseAmountOut", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 102x
  "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG": {
    6002: { name: "ExceededSlippage", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 66x
  "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN": {
    6002: { name: "ExceededSlippage", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
    6033: { name: "InsufficientLiquidity", reason: "Liquidity in bonding curve is insufficient." },
  },
  // seen 38x
  "AhGst6Kzenm2DBMvmaCK8pYkh1yjKXtQGLLyrv3SdRTm": {
    6022: { name: "NoQualifyingGroup", reason: "No trigger wallet reached the threshold." },
  },
  // seen 62x
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": {
    3012: { name: "AccountNotInitialized", reason: "The program expected this account to be already initialized." },
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
    6003: { name: "TooLittleSolReceived", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
    6023: { name: "NotEnoughTokensToSell", reason: "Not enough tokens to sell." },
    6024: { name: "Overflow", reason: "Overflow." },
    6042: { name: "BuySlippageBelowMinTokensOut", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 29x
  "term9YPb9mzAsABaqN71A4xdbxHmpBNZavpBiQKZzN3": {
    6000: { name: "NonceAlreadyExists", reason: "Nonce already exists." },
    6042: { name: "BuySlippageBelowMinTokensOut", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 22x
  "cjg3oHmg9uuPsP8D6g29NWvhySJkdYdAo9D25PRbKXJ": {
    6003: { name: "StaleReport", reason: "Stale report." },
  },
  // seen 13x
  "proVF4pMXVaYqmy4NjniPh4pqKNfMmsihgd4wdkCX3u": {
    6010: { name: "MinReturnNotReached", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 12x
  "DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH": {
    15001: { name: "SlippageLimitExceeded", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
    15999: { name: "InvalidInstructionData", reason: "Invalid Instruction Data." },
  },
  // seen 6x
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": {
    6003: { name: "ExceededAmountSlippageTolerance", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 9x
  "6Vo3245eszAb5wuqEMw8mGdbfRUdKbHhDHP5LcaGuTAB": {
    6002: { name: "ZeroSellAmount", reason: "calculated sell amount is zero." },
    6003: { name: "TooLittleSolReceived", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
    6024: { name: "Overflow", reason: "Overflow." },
  },
  // seen 4x
  "T1TANpTeScyeqVzzgNViGDNrkQ6qHz9KrSBS4aNXvGT": {
    6008: { name: "LessThanMinimumAmountOut", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 3x
  "B4cUJzpPVNKdnjnN7x7MhhXzJT5Z9SpteFp3JK3Y7bow": {
    6003: { name: "E3", reason: "E3." },
  },
  // seen 3x
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C": {
    6005: { name: "ExceededSlippage", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 2x
  "1Rwv1EsfjbrYrZNnfDRrMw8Vp2FK7dXmkxDCYVx5ELS": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 2x
  "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ": {
    6204: { name: "AlreadyCallbackedComputation", reason: "Callback computation already called." },
  },
  // seen 2x
  "Dbx1vaTPYTkWHHvqCaj886avUjzLrRAAes451p3mM3f1": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 2x
  "Hsv7VdZ5ExwCDd5ikxScXqhoJf72hewuh6FJ84m8vFwp": {
    6003: { name: "ExceededAmountSlippageTolerance", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 2x
  "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS": {
    2022: { name: "ConstraintMintTokenProgram", reason: "A mint token program constraint was violated." },
  },
  // seen 1x
  "31d9yCNLSHbVAkovakovoDJ6DK3jDoaeiNhJZocR1axM": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "3RcTZjM82taLUMEo9KcGWqE165Swm9qb6z2bXPR5m6t1": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "48uujWJNWVKrG733SDAWTYXcASbagQ8kRm9xRHRGR7tq": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "5kwx69srU5eUQ9rz1aNbuPwv44PDVHWKKhtNHY9wVP1f": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "5r7fqrLkrkoRsatEU72ekaNgPqin4NRYpAXsMwmPZiK8": {
    6004: { name: "ExceededSlippage", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "8xPG57qFn4Ujj7PFQYm2xtR1k1oohWvbb8DqyF4K1daa": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "9LYscfq3D9pwkse3bts6BvHzexcZf947uueWSx3UKDqZ": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "B7qnnCiZd6WfNHc4becittNreSCjxqPSrKRtWc1YEZ1R": {
    6002: { name: "NoProfitableRoute", reason: "No Profitable Route." },
  },
  // seen 1x
  "BMek9diydhE7gjeY1kKkiNCfoqF4X7hRMm8WnSDSNZWP": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "BoobsBSMpFRBA91sNwKLYShRRQPH5GjoCH4NhLUt4yRo": {
    6013: { name: "SqrtPriceLimitOverflow", reason: "Square root price limit overflow." },
  },
  // seen 1x
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": {
    6011: { name: "SqrtPriceLimitOverflow", reason: "Square root price limit overflow." },
  },
  // seen 1x
  "CkvEApcoFPWUgBDheYvUzHqtUj58AXop7vwizEieXXSE": {
    3005: { name: "AccountNotEnoughKeys", reason: "Not enough account keys given to the instruction." },
  },
  // seen 1x
  "CoTh2vLV87d3wBM7pgLYkkh4q7WBKcVGnVzL3ABuwVR4": {
    6005: { name: "OutputTooLow", reason: "Final output amount is less than the minimum required amount." },
  },
  // seen 1x
  "DMSFQzhYc6zrd4QM4MxuDVKFmkndzm5442mUHNwo75E9": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "DbGxSMpSq3MHRE6WkVFvbfHfUfKUBnewzvsXUTqPwab4": {
    6002: { name: "TooMuchSolRequired", reason: "The price moved between the quote and the transaction landing, so the trade would have returned less than your slippage setting allows. Nothing was swapped and only the fee was spent. Retry, and raise your slippage tolerance slightly if it keeps happening." },
  },
  // seen 1x
  "GbXAnPpj3cnhfvZimH5KqtDJv7EdBU5xoZPuxwX7dz94": {
    6000: { name: "UnprofitableArbitrage", reason: "The round trip did not increase the balance. Reverting the transaction." },
  },
  // seen 1x
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD": {
    6066: { name: "LiquidationRewardTooSmall", reason: "The reward amount is less than the minimum acceptable received liquidity." },
  },
  // seen 1x
  "ord1qJZ3DB52s9NoG8nuoacW85aCyNvECa5kAqcBVBu": {
    3012: { name: "AccountNotInitialized", reason: "The program expected this account to be already initialized." },
  },
  // seen 1x
  "tRunsb6NB127ES14E5Y6pUf3dfJC8DJMPTcbEaWZSLe": {
    6000: { name: "BalanceExceedsThreshold", reason: "Transaction blocked: ATA balance meets or exceeds the threshold." },
  },
  // seen 2x
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": {
    6034: { name: "InvalidSqrtPriceLimitDirection", reason: "Provided SqrtPriceLimit not in the same direction as the swap." },
    6037: { name: "AmountInAboveMaximum", reason: "Amount in above maximum threshold." },
  },
}

/** Every program we hold definitions for. */
export const MAPPED_PROGRAMS = Object.keys(PROGRAM_ERRMAPS)
