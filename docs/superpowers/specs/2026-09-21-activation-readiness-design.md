# Activation: readiness check and first-failure rescue

Status: building on `feat/activation-readiness`. Preview deploys only. Not merged to master without Howard's approval.

## The problem

Protocols want more of their connected wallets to complete a first successful core action. That action is a swap on a DEX, a supply on Benqi, a lock on Team Finance, a stake. Today the widget waits to be asked. Most new users who get stuck never ask. They leave.

## What we are building

**A. Readiness check.** When a new wallet connects, the widget offers a check. Opening it shows a short checklist built from the wallet's real state. Each item has its fix. The job is confidence: tell the user what is already fine, what to do first, and what their wallet is about to ask them.

**C. First-failure rescue.** If their first attempt fails, the failure becomes the top item, with the decoded reason and a way into the chat.

The checklist marks itself done when the first action succeeds.

## Rules carried over from the opener

1. **No amounts** in anything shown unprompted. The prompt bubble never reveals wallet state. It only invites.
2. **Nothing evaluative.** Facts only. No "you should", no suggestion of what or how much.
3. **Absence is not a finding.** A read that did not complete shows as "couldn't check", never as "you have none". A history that was cut short never says "you haven't used this yet".
4. **Never open over a user mid-flow.** No open while they are typing in the host page, and never on a phone.

## Per-project setting (dashboard: Activation)

```ts
activation?: {
  mode: "off" | "prompt" | "open_once"   // default "off"
  action: string                          // one word, as users say it: "deposit", "swap", "lock", "stake"
  contractId?: string                     // watched contract the action is sent to; the approval spender
  spends: { kind: "native" } | { kind: "tokens"; tokens: string[] } | { kind: "any" }
  guideUrl?: string                       // the protocol's own getting-started page
  holdoutPct: number                      // share of new wallets that see nothing, 0 to 50, default 10
}
```

- **off.** Nothing changes. This is the default, and it is what Yamata keeps.
- **prompt.** A small dismissible bubble by the launcher. Clicking it opens the checklist.
- **open_once.** The panel opens on the checklist once per wallet, subject to rule 4.

## Checklist items

| Item | Ready | To do | What to expect | Couldn't check |
|---|---|---|---|---|
| Network | Wallet is on the action's chain | "Your wallet is on X. Switch to Y." | | Chain unknown: omitted |
| Gas | Native balance covers one transaction at the current fee | None, or below one transaction's fee | | Read failed |
| Asset (`tokens`) | Holds a listed token on the chain | Holds it only on another chain, or not at all | | Read failed |
| Approval (`tokens`) | Allowance to the contract already exists | | "Your wallet will ask you to approve USDC first…" | Read failed |
| Approval (`any`, EVM) | | | Generic approve-first heads-up | |
| Failure (C) | | Last attempt failed, with its reason | | |

With `spends: native`, gas and asset are one item.

The order is: failure first, then ready, then to do, then what to expect, then couldn't check. The header counts ready items against checkable ones and never counts an unknown as ready.

## Holdout and measurement

- The arm is deterministic: `hash(projectId:wallet) mod 100 < holdoutPct` means holdout. The same wallet lands in the same arm on every device. Holdout wallets see no prompt and no checklist. The rest of the widget is unchanged for them.
- A new table, `activation_wallets`, has one row per project and wallet. Its columns:
  - arm
  - status: `pending` (history not fully read), `new`, or `existing` (had already used the protocol when first seen, so it is excluded)
  - first_seen, prompted, opened, dismissed, failure_seen, activated_at and activation_tx
  - last complete check
- **Activation** is the first successful transaction from the wallet to a watched contract after first seen. It is read from chain history, so no host code is needed.
- **A history is complete** when the read returned fewer transactions than the page limit. A wallet whose history cannot be read in full stays `pending`. `pending` wallets are excluded, never counted as new. This biases the cohort toward lighter wallets, and the dashboard says so.
- **When wallets are checked.** While the tab is open and the wallet has not activated, the widget re-checks every 60s for up to 15 minutes. A daily cron re-checks new, not-yet-activated wallets for 14 days after first seen. Holdout wallets are checked the same way, silently.
- **Rate per arm** = activated within 14 days ÷ new wallets whose outcome is known. Below 30 known outcomes per arm, the dashboard shows counts and "too early to compare", not percentages.

## Host API

- `window.txid.notifyFailure(hash)`. This is optional. It makes the rescue instant instead of waiting for the indexer.
- **Zero-code wallet detection.** When activation is on, the loader reads the host page's injected EVM wallet with `eth_accounts`, which never opens a popup, and follows `accountsChanged` and `chainChanged`. `identify()` still wins when the host calls it. The loader does none of this unless the frame asks, so projects with activation off see no change in loader behaviour.

## Endpoints

- `GET /api/widget/readiness?key&address&chainId[&failure=hash]`. Rate limited and origin guarded, like the opener. Returns 204 when activation is off. Otherwise it returns `{ arm, state: "new" | "existing" | "unknown" | "activated", checklist? }`, and records the wallet.
- `POST /api/widget/activation-event`. Records `prompted`, `opened` or `dismissed` against the wallet row.
- `GET /api/cron/activation`. The daily re-check.

## Out of scope for v1

- Aptos and other non-EVM approval checks. The Aptos reader covers history and gas only.
- Suggesting a bridge or a venue. That is advice.
- A per-step funnel beyond prompted, opened, dismissed and activated.
