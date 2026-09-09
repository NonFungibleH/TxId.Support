import {
  getTokenInfo,
  getContractState,
  getContractData,
  getTokenPrice,
  getNetworkStatus,
  getContractDeployment,
  fetchAbiFromExplorer,
  fetchAbiWithProxy,
  enrichTransaction,
  getWalletApprovals,
  getTokenBalances,
  checkSanctioned,
} from "@txid/blockchain"

// A fixed set of on-chain checks with KNOWN-correct answers, so regressions in
// the diagnostic tools (wrong chain, wrong decode, wrong price, a dead API) are
// caught automatically instead of during a live demo. Runs against real chains
// using the production keys - hit it from the admin console.

export interface EvalCheck {
  name: string
  pass: boolean
  detail: string
}

export interface EvalResult {
  passed: number
  failed: number
  ranAt: string
  checks: EvalCheck[]
}

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // Ethereum USDC - symbol USDC, decimals 6
const ETH = "0x1"
const ZERO = "0x0000000000000000000000000000000000000000"
// The same well-known, permanently active wallet the approvals check uses, so
// the two Moralis checks are asking about the same account and a difference
// between them is about the ENDPOINT rather than about the address.
const ACTIVE_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

async function check(name: string, fn: () => Promise<{ pass: boolean; detail: string }>): Promise<EvalCheck> {
  try {
    const { pass, detail } = await fn()
    return { name, pass, detail }
  } catch (err) {
    return { name, pass: false, detail: `threw: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * Run the eval suite. `tx`/`txChain` optionally spot-check a real transaction's
 * enrichment (method + events/transfers), since a stable known tx is protocol-specific.
 */
export async function runEval(opts?: { tx?: string; txChain?: string }): Promise<EvalResult> {
  const checks: EvalCheck[] = []

  // 1. ABI auto-fetch returns a parseable ABI for USDC.
  //
  // fetchAbiWithProxy, NOT fetchAbiFromExplorer, because that is what production
  // uses: refreshContractAbi stores the MERGED abi. USDC is a proxy, and a
  // proxy's own ABI is upgrade plumbing (admin, upgradeTo, implementation) with
  // no decimals() and no allowance() in it. Testing with the raw fetch made
  // checks 3 and 4 fail against an ABI no customer's contract would ever have,
  // reporting a product failure that did not exist while testing nothing real.
  //
  // Using the merged fetch also puts the proxy walk itself under test, which is
  // the more valuable check: it is the difference between reading a token's real
  // getters and reading its upgrade plumbing.
  const usdcAbi = await fetchAbiWithProxy(USDC, ETH, fetchAbiFromExplorer).catch(() => null)
  checks.push(await check("abi_fetch (USDC)", async () => ({
    pass: !!usdcAbi && usdcAbi.length > 100,
    detail: usdcAbi ? `ABI length ${usdcAbi.length}` : "no ABI returned",
  })))

  // 2. Token info: standard ERC-20 reads - symbol/decimals must be exact.
  checks.push(await check("token_info (USDC = USDC/6)", async () => {
    const info = await getTokenInfo(USDC, ETH)
    return {
      pass: info?.symbol === "USDC" && info?.decimals === 6,
      detail: `symbol=${info?.symbol} decimals=${info?.decimals} supply=${info?.totalSupplyFormatted ?? "?"}`,
    }
  }))

  // 3. No-arg getter via ABI: USDC.decimals() must decode to 6.
  checks.push(await check("contract_state (USDC.decimals = 6)", async () => {
    const s = await getContractState(USDC, ETH, "decimals", usdcAbi ?? undefined)
    return { pass: s?.value === "6", detail: `value=${s?.value}` }
  }))

  // 4. Getter WITH args: USDC.allowance(0x0, 0x0) must decode to 0 (encode + decode path).
  checks.push(await check("contract_data (USDC.allowance(0,0) = 0)", async () => {
    const d = await getContractData(USDC, ETH, "allowance", [ZERO, ZERO], usdcAbi ?? undefined)
    const val = d ? Object.values(d.result)[0] : undefined
    return { pass: val === "0", detail: `result=${JSON.stringify(d?.result)}` }
  }))

  // 5. Price: chain-correct (must be Ethereum USDC ~$1, not a same-address fork).
  checks.push(await check("token_price (USDC ≈ $1 on ethereum)", async () => {
    const p = await getTokenPrice(USDC, ETH)
    const price = p?.priceUsd ? Number(p.priceUsd) : NaN
    return {
      pass: p?.chain === "ethereum" && price > 0.5 && price < 2,
      detail: `price=${p?.priceUsd} chain=${p?.chain} dex=${p?.dex}`,
    }
  }))

  // 6. Network status: chain responsive + gas present.
  checks.push(await check("network_status (ethereum responsive)", async () => {
    const n = await getNetworkStatus(ETH)
    return {
      pass: !!n?.responsive && !!n.gasPriceGwei,
      detail: `responsive=${n?.responsive} gas=${n?.gasPriceGwei} suggested=${n?.suggestedMaxFeeGwei}`,
    }
  }))

  // 7. Deployment: USDC has a known deployer.
  checks.push(await check("deployment (USDC has deployer)", async () => {
    const dep = await getContractDeployment(USDC, ETH)
    return { pass: !!dep?.deployer && dep.deployer.length === 42, detail: `deployer=${dep?.deployer} ts=${dep?.timestamp}` }
  }))

  // 7b. A CORE Moralis read, so an approvals failure can be told apart from
  // Moralis being unusable.
  //
  // Until this existed the eval had exactly ONE Moralis check, approvals, and
  // that endpoint is tier-gated on some plans. So "the approvals endpoint is
  // not on this plan" and "the key is missing, and every EVM token balance and
  // transaction list is therefore broken" produced an identical red line. Those
  // want very different reactions.
  //
  // getTokenBalances is the right probe because it does NOT fall back to the
  // RPC: token holdings must be enumerated, so this fails when Moralis does.
  // getNativeBalance would pass on the RPC backstop and prove nothing.
  checks.push(await check("moralis_core (token balances readable)", async () => {
    try {
      const bal = await getTokenBalances(ACTIVE_WALLET, ETH)
      return { pass: bal.length > 0, detail: `${bal.length} token balances` }
    } catch (e) {
      return { pass: false, detail: `Moralis unusable: ${e instanceof Error ? e.message.slice(0, 90) : "unknown"}` }
    }
  }))

  // 8. Wallet approvals (Moralis): a highly-active wallet must have >0 approvals,
  // so a broken/empty endpoint is caught rather than silently passing.
  //
  // The lookup now reports WHY it has nothing, which this check needs: a failed
  // read used to arrive as an empty array and was indistinguishable from a
  // wallet that has genuinely approved nothing.
  checks.push(await check("wallet_approvals (active wallet has approvals)", async () => {
    const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    const lookup = await getWalletApprovals(VITALIK, ETH)
    if (lookup.status !== "ok") {
      return { pass: false, detail: `lookup did not complete: ${lookup.status}` }
    }
    return {
      pass: lookup.approvals.length > 0,
      detail: `${lookup.approvals.length} approvals returned`,
    }
  }))

  // 9. Sanctions screening: a known OFAC SDN address must flag; a clean one must not.
  checks.push(await check("sanctions (known SDN address flags)", async () => {
    const s = await checkSanctioned("0x8576aCC5C05D6Ce88f4e49bf65BdF0C62F91353C")
    return { pass: s?.sanctioned === true, detail: `sanctioned=${s?.sanctioned} (${s?.source ?? "no result"})` }
  }))
  checks.push(await check("sanctions (clean address does not flag)", async () => {
    const s = await checkSanctioned("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")
    return { pass: s?.sanctioned === false, detail: `sanctioned=${s?.sanctioned}` }
  }))

  // 10. Optional: enrich a real transaction the caller supplies.
  if (opts?.tx && opts.txChain) {
    checks.push(await check(`tx_enrichment (${opts.tx.slice(0, 10)}…)`, async () => {
      const e = await enrichTransaction(opts.tx!, opts.txChain!, usdcAbi ? [usdcAbi] : [])
      const bits = [
        e?.method ? `method=${e.method}` : null,
        e?.events?.length ? `${e.events.length} events` : null,
        e?.tokenTransfers?.length ? `${e.tokenTransfers.length} transfers` : null,
        e?.confirmations !== undefined ? `${e.confirmations} confs` : null,
      ].filter(Boolean)
      return { pass: !!e && bits.length > 0, detail: bits.join(", ") || "no enrichment returned" }
    }))
  }

  const passed = checks.filter(c => c.pass).length
  return { passed, failed: checks.length - passed, ranAt: new Date().toISOString(), checks }
}
