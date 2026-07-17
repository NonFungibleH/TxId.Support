"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2 as Loader2Icon, Wallet as WalletIcon, CheckCircle2, XCircle, ShieldCheck } from "lucide-react"

// "Review in wallet" card for the Actions feature. The AI prepared an unsigned
// transaction; this card walks the user through signing it in their OWN wallet
// (approve step first when needed, rebuilt fresh after the approval mines).
// Nothing here can move funds without the wallet's own confirmation UI.

export interface WalletActionPayload {
  id: string
  kind: "contract_action" | "swap"
  chainId: string
  summary: string
  originNote: string
  approval?: { to: string; data: string; value: string; token: string; amount: string }
  tx?: { to: string; data: string; value: string; gas?: string }
  expiresAt?: number
  swapMeta?: { fromToken: string; toToken: string; fromAmount: string; minReceived: string }
}

type Phase =
  | "ready"
  | "ack"
  | "wrong_account"
  | "approving"
  | "approval_pending"
  | "rebuilding"
  | "signing"
  | "pending"
  | "confirmed"
  | "failed"
  | "rejected"
  | "expired"
  | "unknown"
  | "error"

interface Eth {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

const ACK_KEY = "txid_actions_ack"

const RPC_URLS: Record<string, string> = {
  "0x1": "https://ethereum-rpc.publicnode.com",
  "0x2105": "https://mainnet.base.org",
  "0x38": "https://bsc-dataseed.binance.org",
  "0x89": "https://polygon-bor-rpc.publicnode.com",
  "0xa4b1": "https://arb1.arbitrum.io/rpc",
  "0xa": "https://mainnet.optimism.io",
  "0xa86a": "https://api.avax.network/ext/bc/C/rpc",
}

interface Receipt { status?: string; gasUsed?: string; blockNumber?: string }

async function rpcReceipt(chainId: string, hash: string): Promise<Receipt | null> {
  const url = RPC_URLS[chainId]
  if (!url) return null
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [hash] }),
    })
    const body = (await res.json()) as { result?: Receipt | null }
    return body.result ?? null
  } catch {
    return null
  }
}

export function ActionCard({
  action: initial,
  apiKey,
  sessionId,
  expectedAddress,
  chainId,
  primaryColor,
  textColor,
  onResult,
}: {
  action: WalletActionPayload
  apiKey: string
  sessionId: string
  expectedAddress: string
  chainId: string | null
  primaryColor: string
  textColor: string
  onResult: (actionId: string, txHash: string, status: "confirmed" | "failed", gasUsed?: string, blockNumber?: string) => void
}) {
  const [action, setAction] = useState<WalletActionPayload>(initial)
  const [phase, setPhase] = useState<Phase>("ready")
  const [errorMsg, setErrorMsg] = useState("")
  const [expired, setExpired] = useState(false)
  const txHashRef = useRef<string | null>(null)
  const doneRef = useRef(false)

  // Swap quotes go stale — the card disables itself at TTL.
  useEffect(() => {
    if (!action.expiresAt) return
    const ms = action.expiresAt - Date.now()
    if (ms <= 0) { setExpired(true); return }
    const t = setTimeout(() => setExpired(true), ms)
    return () => clearTimeout(t)
  }, [action.expiresAt])

  const eth = (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined) ?? null

  const pollReceipt = useCallback(async (hash: string, actionChain: string) => {
    setPhase("pending")
    let providerFails = 0
    for (let i = 0; i < 40; i++) {
      await new Promise(res => setTimeout(res, 3000))
      let receipt: Receipt | null = null
      if (eth && providerFails < 3) {
        try {
          receipt = (await eth.request({ method: "eth_getTransactionReceipt", params: [hash] })) as Receipt | null
        } catch { providerFails++ }
      } else {
        receipt = await rpcReceipt(actionChain, hash)
      }
      if (receipt?.status !== undefined) {
        const ok = receipt.status === "0x1"
        setPhase(ok ? "confirmed" : "failed")
        if (!doneRef.current) {
          doneRef.current = true
          onResult(action.id, hash, ok ? "confirmed" : "failed", receipt.gasUsed, receipt.blockNumber)
        }
        return
      }
    }
    setPhase("unknown")
  }, [eth, action.id, onResult])

  const rebuild = useCallback(async (): Promise<WalletActionPayload | null> => {
    try {
      const res = await fetch("/api/actions/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey, sessionId, actionId: action.id }),
      })
      const body = (await res.json()) as { action?: WalletActionPayload; error?: string }
      if (!res.ok || !body.action) {
        setErrorMsg(body.error ?? "Couldn't rebuild the transaction. Ask again for a fresh one.")
        setPhase("error")
        return null
      }
      return body.action
    } catch {
      setErrorMsg("Couldn't reach the server to rebuild the transaction.")
      setPhase("error")
      return null
    }
  }, [apiKey, sessionId, action.id])

  const sendTx = useCallback(async (tx: { to: string; data: string; value: string; gas?: string }): Promise<string | null> => {
    if (!eth) return null
    try {
      const params: Record<string, string> = { from: expectedAddress, to: tx.to, data: tx.data }
      if (tx.value && tx.value !== "0x0" && tx.value !== "0") {
        params.value = tx.value.startsWith("0x") ? tx.value : "0x" + BigInt(tx.value).toString(16)
      }
      if (tx.gas) params.gas = tx.gas.startsWith("0x") ? tx.gas : "0x" + BigInt(tx.gas).toString(16)
      return (await eth.request({ method: "eth_sendTransaction", params: [params] })) as string
    } catch (err) {
      const code = (err as { code?: number })?.code
      if (code === 4001) { setPhase("rejected"); return null }
      setErrorMsg("The wallet couldn't send the transaction.")
      setPhase("error")
      return null
    }
  }, [eth, expectedAddress])

  const run = useCallback(async () => {
    if (!eth) return
    // First-use acknowledgement (per browser), before any wallet popup.
    if (typeof window !== "undefined" && !localStorage.getItem(ACK_KEY)) { setPhase("ack"); return }

    // Guard against account drift: the signer must match the prepared sender.
    try {
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[]
      if (!accounts[0] || accounts[0].toLowerCase() !== expectedAddress.toLowerCase()) { setPhase("wrong_account"); return }
    } catch { setPhase("wrong_account"); return }

    // Wrong network → one-tap switch before anything else.
    if (chainId !== action.chainId) {
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: action.chainId }] })
      } catch { setErrorMsg("Please switch your wallet to the right network first."); setPhase("error"); return }
    }

    if (action.approval && !action.tx) {
      setPhase("approving")
      const approveHash = await sendTx(action.approval)
      if (!approveHash) return
      setPhase("approval_pending")
      // Wait for the approval to mine, then rebuild the action fresh.
      for (let i = 0; i < 40; i++) {
        await new Promise(res => setTimeout(res, 3000))
        let receipt: Receipt | null = null
        try { receipt = (await eth.request({ method: "eth_getTransactionReceipt", params: [approveHash] })) as Receipt | null } catch { receipt = await rpcReceipt(action.chainId, approveHash) }
        if (receipt?.status === "0x1") break
        if (receipt?.status === "0x0") { setErrorMsg("The approval transaction failed."); setPhase("error"); return }
        if (i === 39) { setPhase("unknown"); return }
      }
      setPhase("rebuilding")
      const fresh = await rebuild()
      if (!fresh?.tx) return
      setAction(fresh)
      setExpired(false)
      setPhase("signing")
      const hash = await sendTx(fresh.tx)
      if (!hash) return
      txHashRef.current = hash
      await pollReceipt(hash, fresh.chainId)
      return
    }

    if (!action.tx) return
    setPhase("signing")
    const hash = await sendTx(action.tx)
    if (!hash) return
    txHashRef.current = hash
    await pollReceipt(hash, action.chainId)
  }, [eth, expectedAddress, chainId, action, sendTx, rebuild, pollReceipt])

  const acknowledge = useCallback(() => {
    try { localStorage.setItem(ACK_KEY, new Date().toISOString()) } catch { /* private mode */ }
    void fetch("/api/actions/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, sessionId }),
    }).catch(() => {})
    setPhase("ready")
    void run()
  }, [apiKey, sessionId, run])

  const busy = ["approving", "approval_pending", "rebuilding", "signing", "pending"].includes(phase)
  const terminal = ["confirmed", "failed", "unknown"].includes(phase)

  return (
    <div className="mt-2 rounded-xl border p-3 text-[12px]" style={{ borderColor: `${primaryColor}55` }}>
      <p className="font-semibold">{action.summary}</p>
      {action.swapMeta && (
        <p className="mt-0.5 opacity-70">Min received: {action.swapMeta.minReceived} {action.swapMeta.toToken} (1% slippage)</p>
      )}
      {action.approval && !action.tx && (
        <p className="mt-0.5 opacity-70">Step 1 of 2: approve exactly {action.approval.amount} {action.approval.token}, then the transaction is rebuilt fresh for you to sign.</p>
      )}

      {phase === "ack" && (
        <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: `${primaryColor}55` }}>
          <p className="flex items-start gap-1.5">
            <ShieldCheck className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Transactions are prepared for review and executed by your own wallet — you review and sign every one.
              This feature may not be available or appropriate in your region; you are responsible for confirming that before using it.
            </span>
          </p>
          <button onClick={acknowledge} className="mt-2 w-full rounded-lg py-1.5 font-semibold" style={{ backgroundColor: primaryColor, color: textColor }}>
            I understand — continue
          </button>
        </div>
      )}

      {phase === "wrong_account" && (
        <p className="mt-2 opacity-80">Your wallet is on a different account than this session. Switch back to {expectedAddress.slice(0, 6)}…{expectedAddress.slice(-4)} and try again.</p>
      )}
      {phase === "rejected" && <p className="mt-2 opacity-80">You rejected the request in your wallet. Nothing was sent.</p>}
      {phase === "error" && <p className="mt-2 opacity-80">{errorMsg}</p>}
      {phase === "expired" || (expired && !busy && !terminal && phase === "ready") ? (
        <p className="mt-2 opacity-80">This quote expired. Ask me again and I&apos;ll prepare a fresh one.</p>
      ) : null}

      {phase === "confirmed" && (
        <p className="mt-2 flex items-center gap-1.5 font-semibold"><CheckCircle2 className="size-3.5" /> Confirmed on-chain</p>
      )}
      {phase === "failed" && (
        <p className="mt-2 flex items-center gap-1.5 font-semibold"><XCircle className="size-3.5" /> Transaction failed — details incoming below</p>
      )}
      {phase === "unknown" && (
        <p className="mt-2 opacity-80">Status unknown — check the transaction in a block explorer{txHashRef.current ? `: ${txHashRef.current.slice(0, 10)}…` : "."}</p>
      )}

      {(phase === "ready" || phase === "rejected" || phase === "wrong_account") && !expired && !terminal && (
        <button
          onClick={() => void run()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 font-semibold"
          style={{ backgroundColor: primaryColor, color: textColor }}
        >
          <WalletIcon className="size-3.5" />
          Review in wallet
        </button>
      )}
      {busy && (
        <p className="mt-2 flex items-center gap-1.5 opacity-80">
          <Loader2Icon className="size-3 animate-spin" />
          {phase === "approving" && "Waiting for the approval signature…"}
          {phase === "approval_pending" && "Approval submitted — waiting for it to confirm…"}
          {phase === "rebuilding" && "Rebuilding the transaction with a fresh quote…"}
          {phase === "signing" && "Waiting for your signature…"}
          {phase === "pending" && "Transaction submitted — waiting for confirmation…"}
        </p>
      )}

      <p className="mt-2 text-[10px] opacity-50">{action.originNote}</p>
    </div>
  )
}
