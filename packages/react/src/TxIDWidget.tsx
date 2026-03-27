import React, { useState, useEffect } from "react"

export interface TxIDWidgetProps {
  /** Your pk_... publishable key from the TxID Support dashboard */
  apiKey: string
  /** Widget position. Default: "bottom-right" */
  position?: "bottom-right" | "bottom-left"
  /** Open the widget on mount. Default: false */
  defaultOpen?: boolean
  /** Override the base URL (for self-hosted deployments) */
  baseUrl?: string
  /** Size of the floating action button in px. Default: 52 */
  buttonSize?: number
}

const SVG_CHAT = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const SVG_CLOSE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export function TxIDWidget({
  apiKey,
  position = "bottom-right",
  defaultOpen = false,
  baseUrl = "https://app.txid.support",
  buttonSize = 52,
}: TxIDWidgetProps) {
  const [open, setOpen] = useState(defaultOpen)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const widgetUrl = `${baseUrl}/widget?key=${encodeURIComponent(apiKey)}`
  const isLeft = position === "bottom-left"

  const base: React.CSSProperties = {
    position: "fixed",
    bottom: 20,
    zIndex: 2147483647,
    ...(isLeft ? { left: 20 } : { right: 20 }),
  }

  const fabStyle: React.CSSProperties = {
    ...base,
    width: buttonSize,
    height: buttonSize,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    background: "#6366f1",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  }

  const iframeStyle: React.CSSProperties = {
    ...base,
    bottom: buttonSize + 28,
    width: 380,
    height: 580,
    border: "none",
    borderRadius: 16,
    zIndex: 2147483646,
    boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    opacity: open ? 1 : 0,
    transform: open ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
    pointerEvents: open ? "auto" : "none",
  }

  return (
    <>
      {/* Always render iframe so it loads in background when closed */}
      <iframe
        src={widgetUrl}
        allow="clipboard-write"
        style={iframeStyle}
        title="TxID Support"
      />
      <button
        onClick={() => setOpen((o) => !o)}
        style={fabStyle}
        aria-label={open ? "Close support chat" : "Open support chat"}
        aria-expanded={open}
      >
        {open ? SVG_CLOSE : SVG_CHAT}
      </button>
    </>
  )
}
