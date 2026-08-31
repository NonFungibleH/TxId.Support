/**
 * Demo data for the Console while the read path is being wired.
 *
 * Deliberately built from REAL cases we have diagnosed: the Aptos ETH/USD order
 * and the BNB Chain USDT swap are transactions we verified against mainnet, down
 * to the gas figures. Fixtures that lie produce interfaces that only work on
 * fixtures, and a support tool has to survive the ugly rows.
 */
export type Basis = "verified" | "derived" | "reported" | "indeterminate"
export type Outcome = "succeeded" | "failed" | "pending"

export interface Interaction {
  id: string
  at: string
  outcome: Outcome
  /** What the user was trying to do, in their language. */
  intent: string
  chain: string
  hash: string
  /** Present only on failures. */
  resolution?: {
    code: string
    category: string
    custody: string
    nextActionOwner: string
    retryable: string
    basis: Basis
    summary: string
    detail: string
    reply: string
    evidence: { label: string; value: string }[]
  }
}

export interface Customer {
  id: string
  label: string
  email: string
  wallet: string
  chain: string
  since: string
  interactions: Interaction[]
}

export const CUSTOMERS: Customer[] = [
  {
    id: "c-4102",
    label: "Marta Reinholt",
    email: "m.reinholt@northwind.example",
    wallet: "0x8cf0191044199b2e976dcc3a31a7eb587a936527c692f18923d9b7a2bc55acca",
    chain: "Aptos",
    since: "2026-05-14",
    interactions: [
      {
        id: "i-1",
        at: "2026-08-26T14:12:52Z",
        outcome: "failed",
        intent: "Update an ETH/USD order",
        chain: "Aptos",
        hash: "0x62505e6a1540197000c94ee12e816e1f2192893ea0dae80475d56b84213c110f",
        resolution: {
          code: "7201",
          category: "SETTLEMENT",
          custody: "Funds with user",
          nextActionOwner: "No one",
          retryable: "No",
          basis: "verified",
          summary: "That order had already left the book, so the update had nothing to change.",
          detail:
            "The order id in this request was not on the ETH/USD book when the request reached the chain. This is normal in fast markets. The transaction aborted, so no position or balance changed, and it cost gas only.",
          reply:
            "Your update to your ETH/USD order didn't go through. That order was no longer on the order book when your request reached the chain, so there was nothing to change. This is common in fast markets. The transaction aborted, so no position or balance was affected, and it cost 0.000176 APT in gas.",
          evidence: [
            { label: "Read at ledger", value: "6938092558" },
            { label: "Raw status", value: "Move abort: EORDER_NOT_FOUND" },
            { label: "Market", value: "ETH/USD" },
            { label: "Gas", value: "0.000176 APT" },
          ],
        },
      },
      { id: "i-2", at: "2026-08-26T14:12:44Z", outcome: "succeeded", intent: "Place an ETH/USD sell order", chain: "Aptos", hash: "0x2d4ea37a69c9a5de40a08014073a14793e04c46be72c9e945b24498e8d828c21" },
      { id: "i-3", at: "2026-08-24T09:41:10Z", outcome: "succeeded", intent: "Deposit 5,000 USDC", chain: "Aptos", hash: "0x9f31c0aa77e21b4c0a0d5f18b2e8d7a4c6b1e93f2d7a8c4b5e6f1a2b3c4d5e6f" },
      { id: "i-4", at: "2026-08-19T17:02:55Z", outcome: "succeeded", intent: "Enable trading (session key)", chain: "Aptos", hash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b" },
    ],
  },
  {
    id: "c-4101",
    label: "Devin Okonkwo",
    email: "devin.o@harbourpoint.example",
    wallet: "0x044696f82fdcba0996ed696dff0a318e9c81e633",
    chain: "BNB Chain",
    since: "2026-07-02",
    interactions: [
      {
        id: "i-5",
        at: "2026-08-26T20:23:02Z",
        outcome: "failed",
        intent: "Swap 60 USDT",
        chain: "BNB Chain",
        hash: "0x4e430d180f42644ca2d61063ef58020db361da2d405cc805a9d7cdde274b1cdd",
        resolution: {
          code: "2103",
          category: "BALANCE",
          custody: "Funds with user",
          nextActionOwner: "User",
          retryable: "Yes, after a change",
          basis: "verified",
          summary: "The wallet held no USDT when the swap ran, so the router could not take the tokens.",
          detail:
            "PancakeSwap's router reverted with TransferHelper: TRANSFER_FROM_FAILED. Reading the token contract at the block before this ran, the wallet's USDT balance was zero and its allowance to the router was zero. Nothing was swapped and only gas was spent.",
          reply:
            "Your swap didn't go through because the wallet had no USDT in it at the time. The router tried to take 60 USDT and there was none available, so the transaction stopped there and nothing was swapped. It's worth checking whether the funds are on a different wallet or a different network.",
          evidence: [
            { label: "Read at block", value: "118255000" },
            { label: "Raw status", value: "TransferHelper: TRANSFER_FROM_FAILED" },
            { label: "USDT balance", value: "0" },
            { label: "Allowance to router", value: "0" },
          ],
        },
      },
      { id: "i-6", at: "2026-08-21T11:15:30Z", outcome: "succeeded", intent: "Approve USDT", chain: "BNB Chain", hash: "0x7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d" },
    ],
  },
  {
    id: "c-4098",
    label: "Priya Raghavan",
    email: "p.raghavan@stellarcap.example",
    wallet: "0x91ab4419d2f0c7e5b8a3d6f1c4e7b0a9d2f5c8e1",
    chain: "Base",
    since: "2026-03-28",
    interactions: [
      {
        id: "i-7",
        at: "2026-08-25T08:55:12Z",
        outcome: "pending",
        intent: "Withdraw 12,500 USDC",
        chain: "Base",
        hash: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f",
        resolution: {
          code: "3102",
          category: "MEMPOOL",
          custody: "Funds with user",
          nextActionOwner: "User",
          retryable: "Yes",
          basis: "derived",
          summary: "The withdrawal is still waiting to be mined because its fee is below the current network rate.",
          detail:
            "The transaction is in the mempool and has not been included. Its max fee sits under the current base fee, so validators are choosing other transactions. Nothing has left the wallet; it can be sped up or cancelled from the sending wallet.",
          reply:
            "Your withdrawal hasn't been processed yet. It was sent with a fee below the current network rate, so it's waiting in the queue rather than failing. The funds are still in your wallet and haven't moved. You can speed it up from your wallet, or wait for network fees to fall.",
          evidence: [
            { label: "Seen in mempool", value: "yes" },
            { label: "Max fee", value: "0.42 gwei" },
            { label: "Current base fee", value: "1.08 gwei" },
            { label: "Basis note", value: "Mempool state is derived, not final" },
          ],
        },
      },
      { id: "i-8", at: "2026-08-11T13:20:44Z", outcome: "succeeded", intent: "Supply 40,000 USDC", chain: "Base", hash: "0x0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c" },
    ],
  },
]

/** Failures grouped by cause: the queue is a list of causes, never of tickets. */
export interface CauseGroup {
  code: string
  category: string
  title: string
  affected: number
  fundsAtRisk: boolean
  trend: "up" | "flat" | "down"
  owner: string
  firstSeen: string
  sample: string
}

export const CAUSES: CauseGroup[] = [
  { code: "2103", category: "BALANCE", title: "Swap ran with no balance in the wallet", affected: 41, fundsAtRisk: false, trend: "up", owner: "User", firstSeen: "2026-08-26T06:10:00Z", sample: "c-4101" },
  { code: "3102", category: "MEMPOOL", title: "Withdrawal underpriced and still queued", affected: 18, fundsAtRisk: true, trend: "up", owner: "User", firstSeen: "2026-08-25T07:44:00Z", sample: "c-4098" },
  { code: "7201", category: "SETTLEMENT", title: "Order amended after it left the book", affected: 9, fundsAtRisk: false, trend: "flat", owner: "No one", firstSeen: "2026-08-24T19:02:00Z", sample: "c-4102" },
  { code: "4101", category: "APPROVAL", title: "Token spend not approved before swap", affected: 6, fundsAtRisk: false, trend: "down", owner: "User", firstSeen: "2026-08-22T10:30:00Z", sample: "c-4101" },
]

export function findCustomer(query: string): Customer | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return (
    CUSTOMERS.find(
      c =>
        c.email.toLowerCase() === q ||
        c.wallet.toLowerCase() === q ||
        c.id.toLowerCase() === q ||
        c.label.toLowerCase().includes(q) ||
        c.interactions.some(i => i.hash.toLowerCase() === q),
    ) ?? null
  )
}
