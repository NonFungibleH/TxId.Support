"use client"

import { useEffect, useRef } from "react"

// React strips javascript: hrefs from JSX, so set it imperatively after mount.
// The anchor stays fully draggable to the bookmarks bar.
export function DemoBookmarklet({ appUrl, demoKey, name, accent }: { appUrl: string; demoKey: string; name: string; accent: string }) {
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const href =
      "javascript:(function(){if(document.getElementById('txid-widget-root'))return;" +
      "var s=document.createElement('script');s.id='txid-widget-script';" +
      `s.src='${appUrl}/widget.js';s.setAttribute('data-key','${demoKey}');` +
      "document.body.appendChild(s);})();void%200"
    ref.current.setAttribute("href", href)
  }, [appUrl, demoKey])

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
      <a
        ref={ref}
        onClick={e => e.preventDefault()}
        draggable
        className="inline-flex cursor-grab items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-black active:cursor-grabbing"
        style={{ background: accent }}
        title="Drag me to your bookmarks bar"
      >
        🔖 Try {name}
      </a>
      <p className="mt-3 text-xs text-muted">Drag this button to your bookmarks bar</p>
    </div>
  )
}
