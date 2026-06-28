"use client"

import { useEffect } from "react"

const WIDGET_KEY = process.env.NEXT_PUBLIC_PLATFORM_WIDGET_KEY
const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL ?? "https://app.txid.support"

export function PlatformWidget() {
  useEffect(() => {
    if (!WIDGET_KEY) return
    if (document.getElementById("txid-platform-script")) return

    const script = document.createElement("script")
    script.id = "txid-platform-script"
    script.src = `${WIDGET_URL}/widget.js`
    script.setAttribute("data-key", WIDGET_KEY)
    document.body.appendChild(script)

    return () => {
      document.getElementById("txid-platform-script")?.remove()
    }
  }, [])

  return null
}
