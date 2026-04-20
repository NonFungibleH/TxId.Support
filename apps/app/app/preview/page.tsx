import { Suspense } from "react"
import { WidgetApp } from "@/app/widget/WidgetApp"

export const dynamic = "force-dynamic"

export default function PreviewPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8 gap-6"
      style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%), #08080f" }}
    >
      {/* Top badge */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md text-white text-[10px] font-bold"
          style={{ background: "#6366f1" }}
        >
          TX
        </div>
        <span className="text-xs font-semibold text-white/50 tracking-wide">TxID Support — Widget Preview</span>
      </div>

      {/* Widget */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          width: 380,
          height: 580,
          boxShadow: "0 0 0 1px rgba(99,102,241,0.2), 0 32px 80px rgba(0,0,0,0.6)",
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

      {/* Footer note */}
      <p className="text-xs text-white/20 text-center max-w-xs leading-relaxed">
        This preview shows your widget exactly as users will see it.
        <br />Powered by <span className="text-white/40">TxID Support</span>.
      </p>
    </div>
  )
}
