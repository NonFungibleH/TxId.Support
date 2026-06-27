"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const STORAGE_KEY = "txid_cookies_accepted"

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // localStorage blocked (e.g. Safari private mode) — don't show banner
    }
  }, [])

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "1") } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-2xl w-full rounded-2xl border border-white/10 bg-[#111] px-5 py-4 shadow-2xl"
      >
        <p className="flex-1 text-sm text-white/60 leading-relaxed">
          We use essential cookies to keep you signed in and make the service work. No tracking or advertising cookies.{" "}
          <Link href="/privacy#cookies" className="text-white/80 underline underline-offset-2 hover:text-white transition-colors">
            Learn more
          </Link>
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-xl bg-white text-black text-sm font-semibold px-5 py-2 hover:bg-white/90 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
