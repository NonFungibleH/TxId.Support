"use client"

import { useEffect } from "react"

/**
 * Injects the TxID Support widget script into the marketing site.
 *
 * Set NEXT_PUBLIC_DEMO_WIDGET_KEY to a publishable key in .env.local to
 * activate the live widget. When the key is absent nothing is rendered.
 *
 * Usage: place <WidgetEmbed /> once anywhere in the layout.
 */
export function WidgetEmbed() {
  const key = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY

  useEffect(() => {
    if (!key) return
    if (document.getElementById("txid-widget-script")) return

    const script = document.createElement("script")
    script.id = "txid-widget-script"
    script.src = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"}/widget.js`
    script.setAttribute("data-key", key)
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.getElementById("txid-widget-script")?.remove()
    }
  }, [key])

  return null
}
