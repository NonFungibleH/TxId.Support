"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Checklist, ChecklistItem } from "@/lib/activation/readiness"

/**
 * The readiness check, in the widget.
 *
 * Kept out of WidgetApp so the whole feature can be read in one place, and so
 * a project with activation off runs none of it: every effect below returns
 * immediately when `activation` is null, which it is for every project until
 * one turns it on in the dashboard.
 *
 * THE DECISION IS HERE, THE ENFORCEMENT IS IN THE LOADER, exactly like beta
 * auto-open. Only this frame has read the config and the checklist, so it
 * decides whether to prompt. Only widget.js can see the host page, so it owns
 * the guards: not over an open panel, not on a phone, not while the user is
 * typing into the host page.
 */

export interface ReadinessResponse {
  arm: "shown" | "holdout"
  state: "new" | "pending" | "existing" | "activated" | "unknown"
  action?: string
  checklist?: Checklist
  guideUrl?: string
  /** Progress re-checks only. */
  failure?: ChecklistItem
}

export interface ActivationWidgetConfig {
  mode: "prompt" | "open_once"
  action: string
}

const EVM = /^0x[0-9a-fA-F]{40}$/
const POLL_MS = 60_000
const POLL_FOR_MS = 15 * 60_000

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* private mode: prompts may repeat, nothing breaks */ }
}

function toLoader(msg: unknown) {
  if (typeof window === "undefined" || window.parent === window) return
  try { window.parent.postMessage(msg, "*") } catch { /* host gone */ }
}

export function useActivation({
  apiKey,
  activation,
  walletAddress,
  chainId,
  embedNonce,
}: {
  apiKey: string
  activation: ActivationWidgetConfig | null | undefined
  walletAddress: string | null
  chainId: string | null
  embedNonce: string | null
}) {
  const [hostWallet, setHostWallet] = useState<{ address: string; chainId: string | null } | null>(null)
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null)
  const [showChecklist, setShowChecklist] = useState(false)
  const [failureHash, setFailureHash] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const on = !!activation

  // The wallet connected in the widget wins; otherwise the one the host page
  // already has. EVM only, which is all v1 checks.
  const wallet =
    walletAddress && EVM.test(walletAddress) ? { address: walletAddress, chainId } :
    hostWallet && EVM.test(hostWallet.address) ? hostWallet :
    null
  const address = wallet?.address ?? null
  const walletChain = wallet?.chainId ?? null
  const flagKey = address ? `txid_act_${apiKey}_${address.toLowerCase()}` : null

  const record = useCallback((event: "prompted" | "opened" | "dismissed") => {
    if (!address) return
    fetch("/api/widget/activation-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, address, event }),
      keepalive: true,
    }).catch(() => { /* the funnel is a side effect */ })
  }, [apiKey, address])

  const openChecklist = useCallback(() => {
    setShowChecklist(true)
    toLoader({ type: "txid-nudge-clear" })
    if (flagKey && lsGet(flagKey) !== "opened") {
      lsSet(flagKey, "opened")
      record("opened")
    }
  }, [flagKey, record])

  // Ask the loader to follow the host page's wallet. It does nothing until
  // asked, so a project with activation off sees no change in the loader.
  useEffect(() => {
    if (on) toLoader({ type: "txid-activation-watch" })
  }, [on])

  const readinessRef = useRef(readiness)
  readinessRef.current = readiness
  const openRef = useRef(openChecklist)
  openRef.current = openChecklist
  const recordRef = useRef(record)
  recordRef.current = record
  const flagRef = useRef(flagKey)
  flagRef.current = flagKey

  useEffect(() => {
    if (!on) return
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window.parent) return
      const d = e.data as { type?: string; address?: string | null; chainId?: string | null; hash?: string; nonce?: string } | null
      if (!d || typeof d.type !== "string") return
      if (embedNonce && d.nonce !== embedNonce) return
      if (d.type === "txid-host-wallet") {
        setHostWallet(typeof d.address === "string" && EVM.test(d.address)
          ? { address: d.address, chainId: typeof d.chainId === "string" ? d.chainId : null }
          : null)
      } else if (d.type === "txid-show-checklist") {
        openRef.current()
      } else if (d.type === "txid-nudge-dismissed") {
        if (flagRef.current) lsSet(flagRef.current, "dismissed")
        recordRef.current("dismissed")
      } else if (d.type === "txid-failure" && typeof d.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(d.hash)) {
        setFailureHash(d.hash)
      }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [on, embedNonce])

  // The full check, whenever the wallet, its chain or a reported failure changes.
  useEffect(() => {
    if (!on || !address) { setReadiness(null); return }
    let cancelled = false
    const qs = new URLSearchParams({ key: apiKey, address, ...(walletChain ? { chainId: walletChain } : {}), ...(failureHash ? { failure: failureHash } : {}) })
    fetch(`/api/widget/readiness?${qs}`)
      .then(r => (r.status === 204 ? null : r.json()))
      .then((d: ReadinessResponse | null) => { if (!cancelled) setReadiness(d) })
      .catch(() => { /* silence is the designed fallback */ })
    return () => { cancelled = true }
  }, [on, apiKey, address, walletChain, failureHash, refreshTick])

  // Whether to say anything unprompted, and what.
  useEffect(() => {
    if (!activation || !readiness || !flagKey) return
    if (readiness.arm !== "shown" || !readiness.checklist) return
    if (readiness.state !== "new" && readiness.state !== "pending") return

    // A failed attempt is a new event, so it is raised once even to someone
    // who dismissed the first prompt. Once per distinct failure.
    const failure = readiness.checklist.items.find(i => i.id === "failure")
    if (failure) {
      const sig = `${failure.title}|${failure.detail ?? ""}`
      if (lsGet(`${flagKey}_f`) !== sig) {
        lsSet(`${flagKey}_f`, sig)
        toLoader({ type: "txid-nudge", text: `${failure.title}. See why.` })
      }
      return
    }

    const flag = lsGet(flagKey)
    if (flag === "dismissed" || flag === "opened") return
    const text = `Getting started? Check your wallet is ready for your first ${activation.action}.`
    toLoader(activation.mode === "open_once" ? { type: "txid-open-checklist", text } : { type: "txid-nudge", text })
    if (flag !== "prompted") {
      lsSet(flagKey, "prompted")
      record("prompted")
    }
  }, [activation, readiness, flagKey, record])

  // While a new wallet has the page open, notice its first success or failure.
  const state = readiness?.state
  const arm = readiness?.arm
  useEffect(() => {
    if (!on || !address || (state !== "new" && state !== "pending")) return
    const started = Date.now()
    const id = setInterval(() => {
      if (Date.now() - started > POLL_FOR_MS) { clearInterval(id); return }
      if (document.visibilityState !== "visible") return
      const qs = new URLSearchParams({ key: apiKey, address, only: "progress", ...(walletChain ? { chainId: walletChain } : {}) })
      fetch(`/api/widget/readiness?${qs}`)
        .then(r => (r.status === 204 ? null : r.json()))
        .then((d: ReadinessResponse | null) => {
          if (!d) return
          if (d.state === "activated" || d.state === "existing") {
            setReadiness(prev => (prev ? { ...prev, state: d.state, ...(d.action ? { action: d.action } : {}) } : d))
            toLoader({ type: "txid-nudge-clear" })
            return
          }
          if (d.failure && arm === "shown") {
            // A new failure: re-run the full check so the item, the headline
            // and the prompt all come from the one place that writes them.
            const known = readinessRef.current?.checklist?.items.find(i => i.id === "failure")
            if (!known || known.title !== d.failure.title || known.detail !== d.failure.detail) {
              setRefreshTick(t => t + 1)
            }
          }
        })
        .catch(() => { /* next tick */ })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [on, apiKey, address, walletChain, state, arm])

  const offer = !!readiness && readiness.arm === "shown" && !!readiness.checklist &&
    (readiness.state === "new" || readiness.state === "pending")

  return {
    readiness,
    /** The wallet the check is about, for adopting into the chat when the user asks a question from it. */
    wallet,
    showChecklist: showChecklist && !!readiness && readiness.arm === "shown",
    setShowChecklist,
    openChecklist,
    /** Show the in-widget entry point. */
    offer,
  }
}
