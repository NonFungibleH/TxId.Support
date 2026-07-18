import type { Metadata } from "next"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { APP_URL } from "@/lib/config"
import { DemoBookmarklet } from "./DemoBookmarklet"

export const metadata: Metadata = {
  title: "Try TxID Support on your site",
  robots: { index: false, follow: false }, // demo share pages aren't for SEO
}

interface WidgetConfig { projectName?: string; branding?: { primaryColor?: string } }

async function getConfig(key: string): Promise<WidgetConfig | null> {
  try {
    const res = await fetch(`${APP_URL}/api/widget-config/${key}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return (await res.json()) as WidgetConfig
  } catch {
    return null
  }
}

export default async function DemoSharePage({ params }: { params: { key: string } }) {
  const key = params.key
  const config = key.startsWith("pk_") ? await getConfig(key) : null
  const name = config?.projectName ?? "this protocol"
  const accent = config?.branding?.primaryColor ?? "#6366f1"

  return (
    <>
      <Navbar />
      <main className="pt-28 pb-24">
        <div className="max-w-2xl mx-auto px-6">
          <p className="font-mono text-sm mb-3" style={{ color: accent }}>Live demo</p>
          <h1 className="font-display text-4xl font-bold text-white mb-4 leading-tight">
            Try {name}&apos;s AI support on your own site
          </h1>
          <p className="text-lg text-muted leading-relaxed mb-8">
            No sign-up. Drag the button below to your bookmarks bar, then open your own website and click it. The TxID
            support widget pops up on your page, so you can see exactly what your users would get.
          </p>

          <DemoBookmarklet appUrl={APP_URL} demoKey={key} name={name} accent={accent} />

          <ol className="mt-10 space-y-4 text-muted">
            <li className="flex gap-3"><span className="font-mono text-sm shrink-0" style={{ color: accent }}>1</span><span>Make sure your bookmarks bar is visible (Cmd/Ctrl+Shift+B in most browsers).</span></li>
            <li className="flex gap-3"><span className="font-mono text-sm shrink-0" style={{ color: accent }}>2</span><span>Drag the <span className="text-white font-medium">Try {name}</span> button up to your bookmarks bar.</span></li>
            <li className="flex gap-3"><span className="font-mono text-sm shrink-0" style={{ color: accent }}>3</span><span>Go to your own website and click that bookmark. The widget appears in the corner.</span></li>
            <li className="flex gap-3"><span className="font-mono text-sm shrink-0" style={{ color: accent }}>4</span><span>Connect a wallet and ask it about a transaction, or anything about the protocol.</span></li>
          </ol>

          <p className="mt-10 text-sm text-muted/70">
            The widget reads public on-chain data only. It never asks for private keys or seed phrases. Some sites with a
            strict content-security policy may block the pop-in; if nothing appears, try it on a different page.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
