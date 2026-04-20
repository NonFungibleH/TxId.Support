import { Suspense } from "react"
import { WidgetApp } from "@/app/widget/WidgetApp"
import Link from "next/link"
import { ArrowLeft, Zap, CheckCircle2, MessageCircle, Wallet, FileText } from "lucide-react"

export const dynamic = "force-dynamic"

const PROMPTS = [
  { icon: "💬", text: "Why did my transaction fail?" },
  { icon: "🔄", text: "How do I swap tokens?" },
  { icon: "💰", text: "What are the protocol fees?" },
  { icon: "🔒", text: "How does staking work?" },
  { icon: "📄", text: "Where can I read the docs?" },
  { icon: "🔍", text: "Is the contract audited?" },
]

const HIGHLIGHTS = [
  {
    icon: Wallet,
    title: "Wallet-aware",
    body: "Detects the connected wallet and can diagnose failed transactions in context.",
  },
  {
    icon: FileText,
    title: "Docs-grounded",
    body: "Answers come from your indexed documentation — not hallucinated.",
  },
  {
    icon: MessageCircle,
    title: "Always on",
    body: "Handles common questions 24/7 so your team doesn't have to.",
  },
]

/**
 * Preview page — shows the live widget centred between info panels,
 * matching the style of the marketing demo page.
 */
export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-[rgba(248,249,251,0.92)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-13 flex items-center justify-between" style={{ height: 52 }}>
          <Link
            href="/dashboard/preview"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to dashboard
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-indigo-600">TxID Support</span>
            <span className="text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5 ml-1">
              Preview mode
            </span>
          </div>
        </div>
      </header>

      {/* ── Page header ── */}
      <div className="text-center pt-12 pb-10 px-6">
        <p className="font-mono text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-3">
          {"// Widget Preview"}
        </p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3" style={{ letterSpacing: "-0.02em" }}>
          Test your support widget
        </h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
          This is exactly how it will appear on your site. Try the prompts on the left,
          then confirm you&apos;re happy before going live.
        </p>
      </div>

      {/* ── Three-column layout ── */}
      <div className="max-w-6xl mx-auto px-6 pb-20 flex flex-col lg:flex-row gap-8 items-start justify-center">

        {/* Left — example prompts */}
        <div className="lg:w-60 w-full shrink-0 space-y-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Try asking
          </p>
          {PROMPTS.map((p) => (
            <div
              key={p.text}
              className="text-left rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none mt-0.5">{p.icon}</span>
                <p className="text-xs text-gray-600 leading-relaxed">{p.text}</p>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-gray-400 pt-1 leading-relaxed">
            Type any of these into the chat widget →
          </p>
        </div>

        {/* Centre — live widget */}
        <div className="flex justify-center flex-1">
          <div className="relative">
            {/* Indigo glow, matching the demo page */}
            <div
              className="absolute inset-0 rounded-2xl blur-3xl scale-90 pointer-events-none"
              style={{ background: "rgba(99,102,241,0.14)" }}
            />
            {/* Widget shell */}
            <div
              className="relative rounded-2xl overflow-hidden shadow-2xl"
              style={{
                width: 340,
                height: 520,
                boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(99,102,241,0.12)",
              }}
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-gray-50 text-gray-400 text-sm">
                    Loading widget…
                  </div>
                }
              >
                <WidgetApp />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Right — what this widget does + pre-live checklist */}
        <div className="lg:w-56 w-full shrink-0 space-y-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            What it does
          </p>

          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <p className="text-xs font-semibold text-gray-900">{title}</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}

          {/* Pre-live checklist */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">Before going live</p>
            <ul className="space-y-1.5">
              {[
                "Answers match your docs",
                "Failed tx question works",
                "Branding looks right",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-amber-700">
                  <CheckCircle2 className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
