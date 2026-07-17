# Actions: AI-Assisted Wallet Execution — Design

**Date:** 2026-07-17 (rev 2, post spec-review)
**Status:** Draft for review
**Feature name:** "Actions" (working name; user-facing copy TBD)

## Summary

An opt-in, plan-gated feature that lets the TxID widget go from *explaining* on-chain activity to *helping the user act*: the user states an intent in chat ("lock 100 HYDX for 3 months", "swap $10 USDC for HYDX", "claim my rewards"), the AI builds the unsigned transaction, and the user reviews and signs it **in their own wallet**. TxID never holds keys, never sends transactions, never recommends trades, and takes **no fee on any transaction**. The protocol customer pays for the feature through their TxID plan.

Two action sources, one execution path:

1. **Protocol contract actions** (lock, stake, claim, deposit, withdraw, …): write functions on the protocol's already-configured `watchedContracts`, gated by a **per-function allowlist** the protocol sets in the dashboard. Calldata is encoded from the stored ABI (extending the existing `estimateAction` path, which already encodes and pre-flights write calls).
2. **Swaps**: quotes + ready-to-sign transactions from a third-party aggregator API (KyberSwap Aggregator at launch; adapter interface keeps this swappable). Used when the intent is a token swap rather than a call to the protocol's own contracts.

## Goals

- The Hydrex-style UX inside the TxID widget: intent → quote/summary → "Review in wallet" card → user signs → bot confirms or diagnoses the result.
- Any *allowlisted* write function on the protocol's watched contracts, not just swaps.
- Zero custody, zero discretion, zero fees. User signs every transaction.
- Off by default; per-project dashboard toggle; available only on paid plans.
- End-user acknowledgement before first use, including region-responsibility language.

## Non-goals (v1)

- No trade **recommendations or solicitation** of any kind (regulatory bright line: SEC "Covered User Interface Providers" staff statement, April 2026 — no discretion, no recommendations, no custody).
- No autonomous/delegated execution, session keys, or agent wallets. Every incident in the space (Grok/Bankr, Freysa, aixbt) involved delegated signing; the user-signs-everything model has no major loss on record.
- No TxID fee on transactions (explicit business decision; also removes aggregator fee-disclosure obligations).
- No bridging / cross-chain swaps. No limit orders. No Solana (paused platform-wide). No Telegram-bot actions (widget only — Telegram has no wallet).
- No dynamic-array/tuple function args, and **no payable functions** in the contract-action allowlist (both inherit `estimateAction`'s restrictions; the picker hides them). Native-value transactions exist only on the swap path (native-coin sells), where the aggregator supplies `value` and the pre-flight passes it through.
- Manual-address mode gets no actions (nothing to sign with; see Widget rules).

## The compliance envelope (product rules)

These are product requirements, not legal advice. They implement the posture the July 2026 research validated.

1. **Execute-only.** The assistant acts only on explicit user intent. It never proposes, suggests, or ranks trades or actions. Enforced in three places: system prompt rules; tool descriptions (tools are "for carrying out the user's stated request only"); and server-side policy (the action tools are only invocable when Actions is enabled — a compromised prompt cannot enable them).
2. **User signs everything.** The only path to execution is `eth_sendTransaction` from the *user's own wallet UI*, initiated by an explicit click on the action card. The widget never auto-clicks, batches, or retries without a new user action.
3. **Allowlist, not open season.** Protocol contract actions are limited to write functions the protocol has explicitly enabled per contract in the dashboard (default: none). Swaps are limited to a routable token set: the protocol's configured token + a curated majors list (native coin, WETH/WBNB/etc., USDC, USDT, DAI). No leveraged/derivative tokens (CFTC Uniswap-order hygiene).
4. **Screening, fail-closed.** On **every** action-tool invocation (no caching — the route is stateless): (a) the connected wallet is screened via the Chainalysis OFAC oracle (`checkSanctioned`); `sanctioned: true` **or a `null`/unreachable oracle result** → the tool refuses with a neutral message (fail closed). (b) Request geo from `x-vercel-ip-country` (+ `x-vercel-ip-country-region` for sub-country granularity) is checked against a blocked-jurisdictions list — a **policy choice** covering at minimum CU, IR, KP, SY, RU and the occupied UA regions. Missing header in production → fail closed; local/dev bypass via `ACTIONS_GEO_DEV_BYPASS=1`. Geo-block applies to the action tools only — support chat keeps working everywhere.
5. **Acknowledgement.** First action per browser: modal in the widget — "Transactions are prepared for review and executed by your own wallet. You review and sign every transaction. This feature may not be available or appropriate in your region; you are responsible for confirming that before using it." → [I understand]. Stored in `localStorage`; recorded server-side via `POST /api/actions/ack` (see Audit).
6. **Pre-flight what can be pre-flighted.** Every prepared transaction is simulated server-side (`eth_estimateGas` from the user's address, extended to pass `value`) before a card is shown, **except** an action gated behind a pending approval: there, the *approval* is pre-flighted at prepare time and the action itself is re-estimated at rebuild time, after the approval confirms (see Lifecycle). `wouldFail` at any stage → no signable step; the bot explains the predicted revert instead.
7. **Freshness.** Swap quotes carry a TTL (60s) **per built transaction, not per stepper**. After an approval confirms, the widget requests a rebuild (fresh quote, fresh calldata, caps re-checked) before step 2 becomes signable. An expired, un-rebuildable card disables itself ("Quote expired — ask again").
8. **Caps, fail-closed.** Per-swap USD cap, default $2,000, protocol-adjustable 0–$25,000 (0 = no swaps, contract actions only). USD value comes from the aggregator quote's own USD estimate, falling back to `getTokenPrice` (DexScreener); **no resolvable price → swap refused**. ERC-20 approvals are exact-amount, never infinite.
9. **Honest marketing.** The `/security` page gains an "Actions (optional)" section stating exactly what changes when a protocol enables it. The "Read-only by design" claim gets qualified with "unless you enable Actions" where it appears. No compliance claims are made for the feature; the sales framing is capability + guardrails, not compliance.

## Architecture

### Data flow (happy path, contract action)

```
User: "lock 100 HYDX for 3 months"
  → chat route (Actions policy gate: enabled? plan? geo? OFAC screen?)
  → model calls prepare_contract_action(contract, function, args)
  → tool: validate against allowlist → encode calldata from stored ABI
    → approval needed? (per-function annotation, see Dashboard) →
        yes: pre-flight the approval; action gas deferred to rebuild
        no:  pre-flight the action (eth_estimateGas incl. value=0)
    → persist prepared action (action_events) → build ActionPayload
  → tool result to model (summary for prose) + clientAction to stream
  → stream.ts clientActionsFrom() → StreamEvent { type: "wallet_action", ... }
  → route.ts SSE `wallet_action` event
  → widget renders ActionCard on the message (mirrors existing switch_chain button)
  → user clicks "Review in wallet" → chain check (wallet_switchEthereumChain if needed)
    → [if approval] eth_sendTransaction(approval) → wait for receipt
        → POST /api/actions/rebuild → fresh action tx (re-preflighted, re-capped)
    → eth_sendTransaction(action)
  → widget polls receipt (wallet provider, RPC fallback) → status on card
  → widget POSTs an actionResult follow-up (exempt from session caps) so the
    bot confirms success or diagnoses failure with ground-truth receipt data
```

Swaps differ only inside the tool: `prepare_swap(fromToken, toToken, amount)` → routable-set check → USD cap check (fail-closed pricing) → aggregator adapter quote (native sells carry `value`) → same pre-flight rules → same `ActionPayload` (plus quote metadata: rate, minReceived, TTL).

### Prepared-action lifecycle & rebuild

The server is the source of truth for every prepared action. `prepare_*` persists the action (id, project, session, kind, canonical params, chain, summary) to `action_events` **before** emitting the payload. The widget holds only the id + payload.

`POST /api/actions/rebuild` — body `{ key, sessionId, actionId }`. Server loads the stored action by id (must match project + session), re-runs the **full policy gate** (toggle, plan, geo, OFAC, allowlist/routable set, USD cap at current price), re-quotes (swaps) or re-estimates (contract actions, now that the approval is mined), and returns a fresh `tx` + new `expiresAt`. Used after approval confirmation and for one-tap refresh of an expired quote. Rebuild is rate-limited per IP and refuses actions older than 15 minutes.

This solves the two sequencing problems a naive design has: (a) an action behind an approval **cannot** be honestly pre-flighted at prepare time (simulation would revert on allowance — so we don't pretend to); (b) a 60s quote **cannot** survive the approval round-trip (so step 2's tx is always freshly built).

### The follow-up contract (chat route change)

Post-transaction confirmation/diagnosis must not collide with chat limits. The chat request body gains an optional `actionResult: { actionId, txHash, status: "confirmed" | "failed", gasUsed?, blockNumber? }`:

- Requests carrying `actionResult` are **exempt from the per-session message cap and from the forced-escalation counter** (they are system-originated, not user turns); they get their own small budget (max 2 per actionId) so the channel can't be abused.
- The route verifies actionId belongs to the session, updates `action_events.status`, and injects the widget-observed receipt data into the model context as ground truth — so diagnosis doesn't race Moralis indexer lag (`get_transaction_by_hash` keeps an RPC-receipt fallback for fresh hashes regardless).
- Persisted messages from this path are labelled as action results (not user turns) so dashboard conversation views render them distinctly.

### ActionPayload (the one new wire type)

```ts
interface ActionPayload {
  id: string                    // uuid; correlates card ↔ audit row ↔ rebuild ↔ actionResult
  kind: "contract_action" | "swap"
  chainId: string               // hex
  summary: string               // rendered from DECODED calldata, never model prose
  approval?: { to, data, value: "0x0", token, amount }   // exact-amount approve, if needed
  tx?: { to, data, value, gas? }  // absent when approval-gated (arrives via rebuild); gas deferred where noted
  expiresAt?: number            // per built tx (swaps)
  swapMeta?: { fromToken, toToken, fromAmount, minReceived, rate }
}
```

Flows as: tool result field → `clientActionsFrom()` (existing extension point, `stream.ts:51`) → new `StreamEvent` variant → new SSE event `wallet_action` (alongside existing `switch_chain`) → widget message state → `ActionCard`.

### Widget rules (ActionCard)

- Renders **only** when `walletSetup === "connected"` (mirrors the existing switch_chain gate). Manual-address sessions never see cards, and the chat request now carries `walletMode: "connected" | "manual"` so the server doesn't build actions for manual sessions in the first place.
- On click, the handler re-reads `eth_accounts[0]` and requires it to match the prepared `from`; mismatch (user switched accounts mid-flow) → card flips to a "reconnect to continue" state. (WidgetApp has no `accountsChanged` listener today; this check is the v1 guard.)
- Approval flows render as a visible stepper: "1. Approve HYDX → 2. Lock", each step its own wallet signature, step 2 disabled until the rebuild returns.
- Receipt polling: wallet provider first; after 3 failed polls, fall back to the chain's `CHAIN_CONFIGS.rpcUrl`; hard timeout → "status unknown — check the explorer" state with the tx link. A card reopened after the iframe was closed shows its last persisted state; unknown is acceptable.
- Origin note on every card: "Your wallet will show this request from app.txid.support (TxID powers this protocol's support)" — the iframe means the wallet popup shows our origin, not the protocol's domain (accepted v1 trade-off; revisit a top-frame handshake post-v1).

### New/changed components

| Layer | Change |
|---|---|
| `packages/blockchain` | `swap/` adapter interface + `KyberSwapAdapter` (GET /routes → POST /route/build); `allowance.ts` (eth_call allowance + exact approve calldata); extend `estimate.ts` to accept `value` |
| `packages/ai` | Two new tools: `prepare_contract_action`, `prepare_swap` (built only when the chat route passes an `actionsPolicy` object — absent = tools don't exist for that request); `clientActionsFrom` handles `ActionPayload`; new `StreamEvent` variant |
| `apps/app` chat route | Actions policy gate (per-invocation OFAC + geo, fail-closed); `walletMode` field; `actionResult` follow-up contract (cap/escalation exemption + own budget); forwards `wallet_action` SSE; audit writes |
| `apps/app` new routes | `POST /api/actions/ack` (acknowledgement record); `POST /api/actions/rebuild` (lifecycle above); both public-key-authenticated like `/api/chat`, rate-limited |
| `apps/app` widget | Acknowledgement modal; `ActionCard` per Widget rules (stepper, rebuild, account-match check, polling with RPC fallback, expiry, origin note); `actionResult` sender |
| `apps/app` dashboard | New Settings → Actions page: master toggle (TokenCardToggle pattern; plan predicate per open question 1 — **`demo`-plan and `publicDemo` projects always excluded**); per-contract function allowlist picker (write functions from stored ABI; static-args + non-payable only; admin-ish names — owner/admin/upgrade/mint — flagged with a warning); **per-function approval annotation** (none / token address + amount-arg index) — required to enable a function that pulls ERC-20s, since no ABI can reveal which token a `lock(uint256,uint256)` pulls; swap USD cap; disclosure copy + acceptance timestamp captured at enable time |
| `apps/app` widget-config route | Whitelist adds `actions: { enabled, ackCopy }` (never the allowlist itself — that stays server-side) |
| `apps/app` config types | `ProjectConfig.actions?: { enabled: boolean; allowedFunctions: Record<contractId, { fn: string; approval?: { token: string; amountArg: number } }[]>; maxSwapUsd: number; enabledAt?: string }` |
| DB (`supabase/migrations/`) | `action_events`: id, project_id, session_id, action_id, kind, chain, summary, params (jsonb), status (`prepared` \| `acknowledged` \| `rebuilt` \| `confirmed` \| `failed` \| `expired`), country, tx_hash, created_at, updated_at. Service-role writes only; surfaced nowhere in v1 (admin/audit use); 12-month retention aligned with conversations |
| `apps/web` | `/security` "Actions (optional)" section; feature page later (marketing, not v1-blocking) |

### Decisions with rationale

- **KyberSwap first**: free public API, all 7 EVM chains, ready-to-sign calldata, no fee entanglement since we charge no fee. **Business prerequisite: their ToS §8.3(b)(v) requires written consent for third-party apps — obtain before GA** (pilot conversations can start in parallel). The adapter interface keeps 0x (their Custom plan, or $0.01/request x402) as a drop-in successor if Kyber consent stalls.
- **Widget-only, EVM-only**: matches existing wallet plumbing (`window.ethereum` in the iframe — the same assumption the shipped connect flow already relies on).
- **Summary from decoded calldata**: the card's human-readable summary is rendered from the decoded transaction, never from model prose — the model cannot misdescribe what the user signs.
- **Errors are a feature**: failed actions flow into TxID's existing decode/diagnosis pipeline via the `actionResult` follow-up, with widget-observed receipt data as ground truth. This closes the loop Hydrex leaves open (their failed swap just showed a toast).

## Rollout

1. **Phase 0 — pilot (env-gated)**: `ACTIONS_PILOT_PROJECT_IDS` allowlist on top of the config toggle. One design partner (the Hydrex conversation is the obvious candidate). Base + Ethereum first. Manual QA with real $1–5 swaps and one partner contract action.
2. **Phase 1 — GA for paid plans**: toggle visible per the plan predicate; docs page; `/security` section live; Kyber written consent in hand.
3. **Legal/business checklist (parallel, non-code)**: Kyber consent; end-user ToU/acknowledgement copy review; blocked-jurisdiction list sign-off; protocol-facing Actions terms accepted at toggle-enable (dashboard records timestamp).

## Risks

| Risk | Mitigation |
|---|---|
| Model prepares wrong-but-valid action (wrong amount/duration) | Summary rendered from decoded calldata; user reviews in wallet; pre-flight; exact-amount approvals cap blast radius |
| Prompt injection reaches action tools | Tools only exist when server policy enables them; allowlist + caps + screening enforced server-side per invocation; nothing executes without a human click in the wallet |
| Stale quote / slippage loss | Per-tx TTL + rebuild flow; 1% slippage default; minReceived shown |
| Approval mined but action never signed | Harmless by construction: exact-amount approval to a known router/contract; surfaced in card state; bot can explain |
| Regulatory drift (US rule sunset, MiCA reading, UK regime Oct 2027) | Execute-only + no-fee + geo-block posture; feature per-project severable (toggle off); quarterly posture review on roadmap |
| Aggregator ToS (Kyber consent) | Written consent before GA; adapter keeps 0x as fallback |
| Protocol enables a dangerous function | Default-off per function; admin-name heuristics warn; payable + dynamic-args excluded; protocol's deliberate choice on their own contract, recorded |
| Account/chain drift mid-flow | Connected-only cards; `eth_accounts` match check at click; chain check before send |
| Widget iframe origin confusion | Explicit origin note on card; revisit top-frame handshake later |

## Testing

The repo has **no test harness today** — standing one up is in scope for this feature (vitest at the affected packages), justified by the policy-gate matrix alone.

- **Automated (new)**: policy-gate matrix (enabled × plan × geo × OFAC-result × allowlist × cap × walletMode — including all fail-closed branches); Kyber adapter against mocked HTTP (quote, build, error shapes); allowance/approve encoding; ActionPayload validation; TTL/rebuild state machine.
- **Simulation-only integration**: prepare tools against live RPC with `eth_estimateGas` assertions — no sends in CI.
- **Manual QA script (pilot)**: Base, real wallet, $1–5 swaps: happy path; wallet reject (4001); wrong chain → switch; approval→rebuild→swap stepper; quote expiry + refresh; account-switch mid-flow → reconnect state; sanctioned-address mock; geo-block mock; missing-geo-header behavior; acknowledgement persistence + server record; failed-tx → diagnosis loop; iframe-closed-during-poll recovery.
- **Regression**: Actions disabled ⇒ zero behavior change (tools absent, no SSE events, no UI). Verified by the eval harness (`apps/app/lib/eval.ts`) + typecheck + manual smoke of the standard chat flow.

## Open questions (for Howard)

1. **Which paid plans include Actions?** (custom+enterprise only, or pro too? `demo`/`publicDemo` are excluded regardless.)
2. **Pilot partner**: pursue Hydrex as design partner, or a friendlier first protocol?
3. **Default swap USD cap**: is $2,000 the right default ceiling?
