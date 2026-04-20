import { Suspense } from "react"
import { WidgetApp } from "@/app/widget/WidgetApp"

export const dynamic = "force-dynamic"

/**
 * Renders a mock DeFi protocol landing page so the user can see their widget
 * exactly as their own users will — floating in the bottom-right corner of a
 * real-looking site, rather than centred on a blank page.
 */
export default function PreviewPage() {
  return (
    <div className="relative min-h-screen overflow-hidden font-sans" style={{ background: "#0a0a0f", color: "#f4f4f5" }}>

      {/* ── Mock site nav ── */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)" }}
        className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-8 h-14">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">P</div>
          <span className="font-semibold text-sm text-white">YourProtocol</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          <span>Swap</span>
          <span>Liquidity</span>
          <span>Stake</span>
          <span>Governance</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
            Connect Wallet
          </button>
        </div>
      </nav>

      {/* ── Mock site hero ── */}
      <main className="pt-14">
        {/* Radial glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.1) 0%, transparent 70%)" }} />

        <div className="max-w-4xl mx-auto px-8 py-24 text-center relative">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1 rounded-full mb-6"
            style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Live on Ethereum · Base · Arbitrum
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-5" style={{ letterSpacing: "-0.03em" }}>
            The decentralised<br />
            <span style={{ color: "#818cf8" }}>liquidity protocol</span>
          </h1>
          <p className="text-base max-w-lg mx-auto mb-10" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
            Swap, earn, and build on the leading DeFi infrastructure.
            Over $2.4B in total value locked across 6 chains.
          </p>

          <div className="flex items-center justify-center gap-3">
            <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#6366f1" }}>
              Launch App
            </button>
            <button className="px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
              Read docs
            </button>
          </div>
        </div>

        {/* ── Mock stats bar ── */}
        <div className="max-w-3xl mx-auto px-8 pb-24">
          <div className="grid grid-cols-3 gap-px rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            {[
              { label: "Total Value Locked", value: "$2.4B" },
              { label: "24h Volume", value: "$180M" },
              { label: "Protocols Integrated", value: "340+" },
            ].map((stat) => (
              <div key={stat.label} className="px-8 py-6" style={{ background: "#0a0a0f" }}>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── TxID Support widget — floating bottom-right ── */}
      <div
        className="fixed z-30 overflow-hidden rounded-2xl"
        style={{
          bottom: 20,
          right: 20,
          width: 380,
          height: 580,
          boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15)",
        }}
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
              Loading…
            </div>
          }
        >
          <WidgetApp />
        </Suspense>
      </div>

      {/* ── Preview badge ── */}
      <div className="fixed bottom-[618px] right-4 z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}>
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        <span className="text-[10px] font-mono text-indigo-300">TxID Support Preview</span>
      </div>
    </div>
  )
}
