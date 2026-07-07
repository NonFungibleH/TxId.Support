# Compliance Features

A compliance-oriented view of TxID Support — for positioning to protocols,
compliance teams, and ecosystem partners. Much of this is **already built** and
simply reframed; the rest is a natural **"Compliance Mode"** product line.

Legend: ✅ built today · 🔨 near-term build · 🔮 larger build / needs a data provider

> **Framing, honestly:** these are compliance-*supporting* features. They help a
> protocol demonstrate user protection, transparency and record-keeping — they do
> not make a protocol "compliant" on their own, and screening/disclaimer features
> require a licensed data source and the protocol's own legal review.

---

## A. Consumer protection & user safety

- ✅ **Approval-risk surfacing** — lists the ERC-20 approvals a wallet has granted and flags **unlimited** ones to review/revoke (the #1 drain vector).
- ✅ **Contract-verification transparency** — tells users whether a contract is verified, whether it's a proxy, and its implementation address.
- ✅ **Plain-English transaction transparency** — explains what a transaction did and why it failed, in language a non-expert understands ("fair, clear, not misleading").
- ✅ **Accurate, non-hallucinated answers** — responses are grounded in the protocol's docs and on-chain data, never invented.
- 🔨 **High-risk-action warnings** — proactively warn on unlimited approvals, interacting with unverified contracts, or wrong-network actions.
- 🔨 **Scam / impersonation / phishing checks** — flag look-alike token addresses, spoofed contracts, and fake-support patterns.

## B. AML / sanctions / address screening  *(the premium module)*

- 🔮 **Sanctions screening** — flag if a counterparty address is on OFAC / UN / EU lists.
- 🔮 **Illicit-activity screening** — known hacks, mixers, scam addresses, high-risk exposure (integrate Chainalysis / TRM / Elliptic).
- 🔮 **Counterparty risk scoring** — a risk band on the address a user is about to interact with.
- 🔨 **Screen-on-connect / pre-transaction** — run screening when a wallet connects or before a flagged action.
- 🔨 **Configurable block vs warn** — the protocol sets thresholds and whether to warn or hard-block.

## C. Record-keeping & auditability

- ✅ **Immutable, timestamped interaction log** — every support conversation and escalated ticket is stored and dated.
- ✅ **Ticket / escalation records** with status — a defensible trail of what support did.
- 🔨 **Audit export** — download the interaction trail (CSV/JSON) for auditors, regulators, or dispute resolution.
- 🔨 **Retrieve-by-wallet / session** — "what did we tell this user?" on demand.
- 🔨 **Configurable data-retention policy** — set how long records are kept.
- 🔮 **Tamper-evidence** — hash-chain the logs so records can be proven unaltered.

## D. Controlled disclosures & advice guardrails

- ✅ **No financial / investment advice** — the bot doesn't give price predictions or "should I buy" answers.
- ✅ **No custody, no execution** — it diagnoses and informs; it never moves funds, which keeps it clear of regulated activity.
- ✅ **Scope enforcement** — only the protocol's own contracts; never comments on or compares competitors.
- 🔨 **Mandatory disclaimer injection** — automatically append the protocol's required legal disclaimers to relevant answers.
- 🔨 **Jurisdiction-aware disclaimers** — different disclaimers by region, configurable.
- 🔨 **Response QA evidence** — the eval harness provides repeatable proof that answers stay accurate over time.

## E. Data protection & privacy (GDPR / CCPA)

- ✅ **No PII required** — wallet-based; users aren't asked for personal identity to get help.
- ✅ **Secrets never exposed** — bot tokens / keys are excluded from anything client-facing.
- 🔨 **Right-to-erasure** — delete a user's conversation history on request.
- 🔨 **Data-minimisation & residency controls** — store only what's needed; configurable region/retention.
- ✅ **No data resale** — user interactions aren't sold or shared.

## F. Transparency & on-chain proof (protocol-side)

- ✅ **Live holdings / TVL / locked amounts** — supports transparency and proof-of-reserves narratives with real on-chain numbers.
- ✅ **Live contract-state disclosure** — users can verify current fees, pause status, owner, limits against what the protocol claims.
- ✅ **Upgrade-history transparency** — shows implementation changes over time (governance/admin activity).
- ✅ **Deployment provenance** — who deployed a contract and when.

## G. Operational governance

- ✅ **Admin access control** — configuration is gated to admins.
- ✅ **Network/RPC health awareness** — the bot can flag chain issues rather than mislead.
- 🔨 **Config change logging** — an audit of who changed what settings.
- 🔨 **Per-jurisdiction behaviour** — regional rules for disclaimers/screening.

---

## Packaging / go-to-market

**Included today (reframe as trust & safety):** everything marked ✅ — approval
hygiene, verification checks, transaction transparency, audit-logged support,
accurate/scoped answers, no-advice/no-custody guardrails, privacy-by-default,
on-chain transparency. This lets you say *"our agent already improves user
protection, transparency and record-keeping"* out of the box.

**"Compliance Mode" — a paid upsell:** the �Rebuild/🔮 items packaged as a tier —
**sanctions & illicit-address screening, disclaimer injection, audit export,
retention/erasure controls, tamper-evident logs**. This is what compliance teams
at larger protocols will pay for, and it's a moat generic support tools can't match.

**One-line pitch:** *"The only user-support agent that also improves your
compliance posture — approval-risk warnings, sanctions screening, and a complete,
exportable record of every user interaction."*

## Dependencies to unlock the premium items

- **Screening (B):** a licensed data provider — Chainalysis, TRM Labs, Elliptic,
  or a free OFAC SDN list for a basic tier.
- **Legal review:** disclaimer wording and any screening thresholds should be
  signed off by the protocol's counsel.
- **Storage/retention (C, E):** minor DB work for export, erasure, retention, and
  optional log hash-chaining.
