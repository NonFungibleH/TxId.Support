import { Suspense } from "react"
import { WidgetApp } from "@/app/widget/WidgetApp"

export const dynamic = "force-dynamic"

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center p-8 gap-4">
      <p className="text-xs text-gray-400 tracking-wide uppercase">Widget Preview</p>
      <div
        className="rounded-2xl overflow-hidden shadow-2xl"
        style={{ width: 380, height: 580 }}
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
      <p className="text-xs text-gray-400">
        This is exactly how your widget appears to users
      </p>
    </div>
  )
}
