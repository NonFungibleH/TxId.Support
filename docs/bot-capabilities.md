# Bot Diagnostic Capabilities

Internal reference for what the support bot can read and diagnose on-chain, the
tools that back each capability, and the behavioural rules it follows. This is
the USP surface — keep it current as tools are added.

Legend: ✅ built · ⚠️ partial · ❌ not yet

---

## How it works (architecture)

The bot combines **docs RAG** (the protocol's indexed documentation) with a set
of **on-chain tools scoped to the protocol's watched contracts**. On each turn
the model decides which tools to call; results are returned as structured JSON
that the model turns into a plain-English answer.

- **Model:** Claude Haiku (primary) with a Groq Llama fallback; both share the
  same tool interface.
- **Data sources:** Moralis (tx/balances), public chain RPCs (eth_call, logs,
  receipts, gas), Etherscan V2 (ABI, deployment, verification, logs),
  4byte.directory (unknown selectors/events).
- **Decoding:** in-house Keccak-256 + ABI encoder/decoder (`packages/blockchain/src/keccak.ts`,
  `abi.ts`) — no external dependency, validated against known vectors.
- **Chain handling:** transaction lookups **auto-detect the chain** by searching
  every relevant chain in parallel; the bot never assumes the wallet's chain.

Key files: `packages/blockchain/src/*` (data + decode), `packages/ai/src/tools.ts`
(tool definitions + executors), `packages/ai/src/prompt.ts` (rules + guidance).

---

## Behavioural rules (enforced)

**Accuracy & honesty**
1. Never assume the chain — auto-detect; state the chain found; if not found,
   list the chains checked.
2. Only state what a tool returned — never infer or fill in unfetched values.
3. Cite the source of every on-chain claim (chain, contract, field).
4. "Not found" ≠ "dropped" — only claim a status a tool reported.
5. Never fabricate — a truthful "couldn't find it" beats a guess.

**Scope & behaviour**
6. Only the protocol's own contracts (enforced in the tx tool, not just prompted).
7. Look it up — don't ask the user for data the bot can fetch.
8. Suggest only answerable questions (suggestion generator is capability-aware).
9. Escalate cleanly to a ticket rather than looping.

**Expert method (added 2026-07-08)**
10. **Clock** — every prompt carries the current UTC time; timestamps become
    dates + relative time ("15 Aug 2026 — about 6 weeks away").
11. **Humanized data** — base units → decimals-adjusted amounts, 2^256-1 =
    "unlimited", basis-point inference, arrays summarised, addresses shortened.
12. **Close the loop** — after finding WHY something failed, check the user's
    CURRENT state (allowance now, gas now, paused now) and give the exact next
    step with real values.
13. **Verify receipt** — "didn't receive tokens" → read the tx's tokenTransfers
    before assuming; if they arrived, provide the token address to import.
14. **Never repeat failed advice** — on "still failing", fetch the newest tx,
    compare with the earlier failure, go deeper or escalate.
15. **Safety triangulation** — "is this safe/audited?" → declared audits +
    on-chain verification + contract age, stated as what checks out vs not.
16. **Live data beats docs** for anything that changes (fees, paused, price,
    gas, balances); docs for how things work.

---

## 1. Transaction level

| Capability | Status | Tool / mechanism |
|---|---|---|
| Status: success / failed / pending / dropped / replaced | ✅ | `get_transaction_by_hash` + `diagnosePendingTx` |
| Which chain it's on (auto-detect) | ✅ | multi-chain search in the tx tool |
| Failure: out-of-gas · revert reason · custom error · panic · unknown | ✅ | `decodeTxRevert` (eth_call replay + ABI + 4byte) |
| What it did — decoded function name | ✅ | selector match vs ABI |
| Decoded call **arguments** | ✅ | `enrichTransaction` → ABI arg decode |
| **Every event** emitted, decoded | ✅ | `enrichTransaction`: all ABIs + standard events + 4byte fallback |
| ERC-20/721/1155 **token transfers** (with symbol/decimals) | ✅ | receipt logs + token metadata |
| Pending/stuck: underpriced gas · stuck nonce · congestion | ✅ | `diagnosePendingTx` |
| Gas over/underpaid | ✅ | `gas.verdict` (effective vs base fee) |
| L2 fee explanation (OP-stack L1 data fee) | ✅ | `gas.l1DataFeeNative` from the receipt (Base/Optimism) |
| Confirmations | ✅ | latest block − tx block |
| Pre-flight ("would it work if I retried now?" / "what will X cost?") | ✅ | `estimate_action` (eth_estimateGas from the user's wallet; revert = would fail now, with reason) |
| Bridge awareness (two-leg model, don't call funds lost) | ✅ | prompt-level guidance on bridge sends |
| Full internal traces / step-by-step re-simulation | ❌ | needs a tracing provider (Tenderly / Alchemy) |

## 2. Smart-contract level

| Capability | Status | Tool / mechanism |
|---|---|---|
| Deployment date / deployer / creation tx | ✅ | `get_contract_deployment` (Etherscan; Base needs paid tier) |
| Event history (when fees changed, paused…) | ✅ | `get_contract_events` (Etherscan logs) |
| Live state — no-arg getters (fee, paused, owner) | ✅ | `get_contract_state` (eth_call) |
| **Getters with arguments** (getUserLock, allowance, balanceOf) | ✅ | `get_contract_data` (ABI encode + eth_call + decode) |
| Holdings / TVL (tokens custodied) | ✅ | `get_contract_holdings` |
| Verification status / proxy → implementation | ✅ | `get_contract_info` (Etherscan getsourcecode) |
| Function catalogue ("what can this contract do") | ✅ | `get_contract_functions` (from ABI) |
| Upgrade history (proxy) | ✅ | `get_upgrade_history` (Upgraded events) |
| Custom-error catalogue (glossary) | ✅ | dashboard error glossary → prompt |

## 3. Token level

| Capability | Status | Tool |
|---|---|---|
| A wallet's balance of a token | ✅ | `get_wallet_balance` |
| Supply / decimals / symbol / name | ✅ | `get_token_info` (any ERC-20, no ABI needed) |
| Allowances / approvals ("do I need to approve?") | ✅ | `get_token_allowance` (standard ERC-20) |
| Per-user lock / vesting schedule | ✅* | `get_contract_data` (getter with args) |
| Price (USD) | ✅ | `get_token_price` (DexScreener, free) |
| Scam/honeypot screen (sell tax, mintable, blacklist…) | ✅ | `check_token_safety` (GoPlus, free + keyless; validated live) |
| Fee-on-transfer detection | ✅ | prompt heuristic: transfer deltas + `check_token_safety` corroboration |
| ENS name resolution (vitalik.eth → 0x…) | ✅ | `resolve_ens_name` (on-chain registry; validated live) |

\* works when the watched contract exposes the getter and its ABI is uploaded.

## 4. Wallet level

| Capability | Status | Tool |
|---|---|---|
| Native balance → enough for gas | ✅ | `get_wallet_balance` + pending `insufficient_gas_balance` |
| Token balances | ✅ | `get_wallet_balance` |
| Nonce / stuck detection | ✅ | `diagnosePendingTx` |
| Recent transactions | ✅ | `get_recent_transactions` |
| Wrong-network detection | ✅ | prompt-level check: wallet chain vs protocol chains → explicit warning |
| Approvals the wallet has granted | ✅ | `get_wallet_approvals` (Moralis) — lists token/spender/amount, flags unlimited |

## 5. Network / RPC level

| Capability | Status | Tool |
|---|---|---|
| Nonce gaps / mempool (stuck/dropped) | ✅ | `diagnosePendingTx` |
| RPC health (chain up but tx not visible → user's RPC) | ✅ | `get_network_status` responsiveness + prompt diagnosis |
| Current gas price / base fee → recommended max fee | ✅ | `get_network_status` (`suggestedMaxFeeGwei`) |
| Chain-level incident awareness | ⚠️ | `get_network_status` detects an unresponsive RPC; no external status feed |

## 6. Protocol / docs

| Capability | Status |
|---|---|
| Features, fees, how-to, tokenomics, FAQ (RAG) | ✅ |
| Custom error/event glossary (team's exact wording) | ✅ |

## 7. Compliance & trust

| Capability | Status | Tool / mechanism |
|---|---|---|
| OFAC sanctions screening (any address or connected wallet) | ✅ | `check_address_sanctions` (Chainalysis on-chain oracle, keyless) |
| Protocol-declared audits cited with report links | ✅ | dashboard Audits manager → prompt injection |
| On-chain source verification / proxy transparency | ✅ | `get_contract_info` |
| Safety triangulation (audits + verification + age) | ✅ | prompt-level method |
| UN / EU sanctions lists | ❌ | needs additional list source |
| Risk scoring (mixer exposure, stolen funds) | ❌ | needs Chainalysis/TRM paid API |

---

## Constraints & known gaps

- **Explorer access** tries Etherscan V2 first, then **Blockscout** (free,
  keyless) for Base / Optimism / Polygon / Arbitrum — so ABI auto-fetch, event
  history, deployment and verification work on those chains without a paid
  Etherscan plan (validated on Base). **BSC** has no Blockscout instance, so it
  still depends on Etherscan/BscScan coverage.
- **ABI required** for method/arg/event decoding on a contract (token transfers
  decode without it). Upload each watched contract's ABI in the dashboard.
- **Static types only** for getter arguments and struct returns (address, uint,
  int, bool, bytesN). Dynamic args (string/bytes/arrays) and nested tuples are
  not encoded yet.
- **Internal traces / re-simulation** (the "why did this internal call revert" /
  "what happens if you resend" tier) require a tracing RPC (Tenderly/Alchemy).
- **Token price** requires a DEX/oracle source.
- Enrichment uses **public RPCs** — fine for demo/light traffic; a dedicated RPC
  (Alchemy/Infura) is recommended for production reliability and rate limits.

## Gap analysis — toward "any issue a user can have" (2026-07-08)

Ordered by how often real support conversations would hit the gap:

| # | Gap | User issue it blocks | Status |
|---|---|---|---|
| 1 | **Full simulation & internal traces** | reverts inside internal calls; step-by-step replay | ❌ needs Tenderly/Alchemy key (free tiers exist). Partially covered by `estimate_action` pre-flight. |
| 2 | **Token safety screen** | "I bought a token I can't sell"; "is this a scam?" | ✅ shipped 2026-07-08 (`check_token_safety`, GoPlus) |
| 3 | **Solana parity** | contract/token/network tools are EVM-only | ❌ medium build; needs non-rate-limited RPC |
| 4 | **Screenshot input** | users paste error screenshots; widget is text-only (Haiku is vision-capable) | ❌ widget + route change, medium |
| 5 | **Bridge awareness** | "I bridged and my tokens haven't arrived" | ⚠️ two-leg guidance shipped; full destination-chain tracking not built |
| 6 | **Page-context awareness** | bot doesn't know which page the user is on | ❌ pass embedding page URL into the prompt — small |
| 7 | **ENS resolution** | user pastes `name.eth` | ✅ shipped 2026-07-08 (`resolve_ens_name`, validated live) |
| 8 | **Pre-flight / gas estimate** | "how much will X cost?"; "would it work now?" | ✅ shipped 2026-07-08 (`estimate_action`) |
| 9 | **L2 fee explanation** | "why did I pay more than gasLimit × gasPrice on Base?" | ✅ shipped 2026-07-08 (`l1DataFeeNative`) |
| 10 | **Fee-on-transfer detection** | "I received fewer tokens than I sent" | ✅ shipped 2026-07-08 (transfer-delta heuristic + safety corroboration) |
| 11 | **UN/EU sanctions + risk scoring** | institutional compliance asks | ❌ list source / paid API |
| 12 | **BSC explorer depth** | ABI auto-fetch/history on BSC | ❌ paid Etherscan tier or alternative |
