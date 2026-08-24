# Aptos / Decibel — Live Demo Runbook

**Audience:** the Aptos team. **Goal:** two wow-moments — (1) the widget genuinely understands Aptos on-chain data, (2) setup takes ~90 seconds, live.
**Strategy:** create the Decibel demo live in the demo creator; run it on our widget preview (Decibel's own app blocks embedding — see Fallbacks).

---

## Pre-call checklist (do all before the call)

- [ ] **`APTOS_API_KEY` set** in the app's Vercel env (build.aptoslabs.com). Removes the single biggest live-latency risk.
- [ ] **Petra installed + funded** (throwaway wallet, a little APT). Ideally the wallet has **traded on Decibel** so its own history contains a real position/order — makes the connected-wallet flow personal. If not, use the paste-a-trader-address path.
- [ ] **One full dry run** end-to-end (below), timed. Every question asked at least once.
- [ ] **Known-good failed-tx hash** on hand: `0x666ac30f4c196c038dbb17cf9440490c71c757576b213d831ba1b99a4b906f8b` (2026-08-24: a real failed Decibel spot bulk order, `EINSUFFICIENT_PFS_FUNDS`: wallet balance short on one side of the pair — mapped with a trader-voiced answer). Alternate: `0xb9c0f58cfd0f0786d6820ba81e1b9da4f17e2dad8b2d21ec10d9c1c8df7c6fdd` (2026-08-21, `EORDER_NOT_FOUND` order-cancel failure, also mapped).
  - ⚠️ **DEMO HASHES EXPIRE.** Public fullnodes prune history after ~2–3 weeks (`oldest_ledger_version` on `/v1/`), after which the hash 404s from the API while explorers still show it — this burned us on 2026-08-21 when the July hash returned "not found" mid-test. **Verify the hash resolves on the day of the call:** `curl -s https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/<HASH> | head -c 200` must return a transaction, not `transaction_not_found`.
  - **To refresh:** batch-scan recent ledger versions for Decibel failures (one request per 100 txs; use `APTOS_API_KEY` as a Bearer header or the anonymous limit bites): fetch `/v1/transactions?start=<recent_version>&limit=100`, filter `type=user_transaction, success=false`, payload function containing the Decibel package. Decibel is active enough that a few thousand versions usually contain one. If the abort is not yet in `packages/aptos/src/errmap.ts`, add it (observed-on-mainnet entries are the errmap's own convention) so the diagnosis is crafted, not generic.
- [ ] **Decibel mainnet package address** on hand: `0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06`.
- [ ] **Fallback pre-built demo** created + tested (identical config), one click away if live creation hiccups.

---

## The live flow (with talk-track)

1. **Open the demo creator** (`/admin/demos`) → **New demo**. *"Let me build you one from scratch, right now."*
2. **Brand it** — set the primary colour to Decibel's. Thirty seconds. *"This is white-label — it's your product, not ours."*
3. **Add the contract** — chain **Aptos**, paste the Decibel package address. The module picker populates from on-chain (all 91 modules). Optionally pin `perp_engine`. *"It just read your published modules straight off the chain — no ABI upload, no verification step. On Aptos that metadata is always there."*
4. **Crawl the docs** — paste `https://docs.decibel.trade`. *"Now it's reading your actual documentation."* (Watch the crawl time; if slow, keep talking — see Fallbacks.)
5. **Open the widget** (Preview). *"That's the whole setup. Now let's use it."*
6. **Connect Petra** (or paste a trader's address). *"It pulls the wallet's real Decibel activity."*

---

## Questions to ask (in order — each is chosen to land)

1. **Paste the known-good failed-tx hash** → *"why did this fail?"*
   The headline moment. Returns the crafted perp-trader explanation (TP/SL order id no longer live), not an error code. **This is the most reliable demo beat — lead with it.**
2. **"What's my APT balance / what tokens do I hold?"** → real on-chain balances.
3. **"What does the `perp_engine` module do / what functions does it expose?"** → reads the on-chain module ABI live.
4. **A docs question** — e.g. *"how does Decibel handle liquidations?"* → answered from their crawled documentation.
5. *(If the connected wallet has a real failure in its history)* **"why did my last trade fail?"** — the no-hash path. Only do this live if the dry run confirmed that wallet's history surfaces the failure (Decibel's gas-station flows can leave a pasted address's history empty — hence hash-first).

---

## Fallbacks (decide these before, never improvise live)

- **Bookmarklet won't work on app.decibel.trade** — their CSP blocks third-party injection (verified). This is expected and fine: demo on the **widget preview / share link**. Talk-track: *"Your CSP blocks third parties — good, it should. In production this runs on your own domain, so it's one allowlist line, like Intercom."* Optionally show the embed snippet to make "easy to install" concrete.
- **Docs crawl slow** — it's server-rendered and crawlable (verified), but if it runs long, cover with the "reading your real docs" talk-track, or crawl a single section.
- **Live creation hiccups** (wifi / rate limit) — switch to the pre-built fallback demo (one click). Rehearse this switch.
- **A tool answer is slow/empty mid-chat** — usually anonymous rate limits; the `APTOS_API_KEY` prevents this. If it still happens, re-ask (single retry usually clears it) or fall back to the known-good hash.

---

## Do NOT over-promise (honest scope)

- **No execute/trade on Aptos** — the bot diagnoses and guides; it does not sign transactions on Aptos (that's EVM-only today). If asked: *"Execution's live on EVM; Aptos execution is on the roadmap."*
- **Sanctions screening + token-safety scoring are EVM-only** — the bot says so honestly if asked; don't present them as Aptos features.
- **Diagnosis depth** — deep where a protocol publishes its errors (Decibel does, via their SDK docs — that's why the demo is sharp). For a random module with only raw codes, the bot is honest: "aborted with code N, no published description." Frame this as a feature (never fabricates), not a gap.

---

## The close

*"Everything you just watched — the setup, the on-chain reads, the diagnosis in your own users' language — is live on Aptos mainnet today. The only thing between this and your users having it is one script tag on your domain."*
