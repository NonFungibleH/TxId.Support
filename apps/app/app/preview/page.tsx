"use client"

import { Suspense, useState } from "react"
import { useTheme } from "next-themes"
import { WidgetApp } from "@/app/widget/WidgetApp"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"
import Link from "next/link"
import { ArrowLeft, Zap, CheckCircle2, MessageCircle, Wallet, FileText, Sun, Moon } from "lucide-react"

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

function sendPrompt(text: string) {
  window.dispatchEvent(new CustomEvent("txid-prompt", { detail: text }))
}

export default function PreviewPage() {
  // Follow the dashboard's theme by default; the toggle sets a local override.
  const { resolvedTheme } = useTheme()
  const [override, setOverride] = useState<boolean | null>(null)
  const isDark = override ?? (resolvedTheme !== "light")
  // Mirror the live embed: the X collapses the widget to the floating launcher.
  const [widgetOpen, setWidgetOpen] = useState(true)

  const bg = isDark ? "bg-[#0b0c14]" : "bg-[#f8f9fb]"
  const headerBg = isDark ? "bg-[rgba(11,12,20,0.92)] border-white/8" : "bg-[rgba(248,249,251,0.92)] border-gray-200"
  const cardBg = isDark ? "bg-[#0f1020] border-white/8" : "bg-white border-gray-200"
  const textPrimary = isDark ? "text-white" : "text-gray-900"
  const textMuted = isDark ? "text-white/50" : "text-gray-400"
  const textBody = isDark ? "text-white/70" : "text-gray-600"
  const checklistBg = isDark ? "bg-amber-950/30 border-amber-500/20" : "bg-amber-50 border-amber-200"
  const checklistTitle = isDark ? "text-amber-400" : "text-amber-800"
  const checklistText = isDark ? "text-amber-300/80" : "text-amber-700"
  const checklistIcon = isDark ? "text-amber-500" : "text-amber-500"

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${bg}`}>

      {/* ── Top bar ── */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-md ${headerBg}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between" style={{ height: 52 }}>
          <Link
            href="/dashboard/preview"
            className={`inline-flex items-center gap-1.5 text-sm transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to dashboard
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-indigo-500">TxID Support</span>
              <span className={`text-xs rounded-full px-2.5 py-0.5 ml-1 ${isDark ? "text-white/40 bg-white/5 border border-white/10" : "text-gray-400 bg-gray-100 border border-gray-200"}`}>
                Preview mode
              </span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={() => setOverride(!isDark)}
              className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors ${
                isDark
                  ? "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                  : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              {isDark ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
              {isDark ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Page header ── */}
      <div className="text-center pt-12 pb-10 px-6">
        <p className="font-mono text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-3">
          {"// Agent Preview"}
        </p>
        <h1 className={`text-3xl font-bold mb-3 ${textPrimary}`} style={{ letterSpacing: "-0.02em" }}>
          Test your support agent
        </h1>
        <p className={`text-sm max-w-md mx-auto leading-relaxed ${textMuted}`}>
          This is exactly how it will appear on your site. Click a prompt on the left to try it,
          then confirm you&apos;re happy before going live.
        </p>
      </div>

      {/* ── Three-column layout ── */}
      <div className="max-w-6xl mx-auto px-6 pb-20 flex flex-col lg:flex-row gap-8 items-start justify-center">

        {/* Left — example prompts */}
        <div className="lg:w-60 w-full shrink-0 space-y-2">
          <p className={`text-[11px] font-semibold uppercase tracking-widest mb-4 ${textMuted}`}>
            Try asking
          </p>
          {PROMPTS.map((p) => (
            <button
              key={p.text}
              onClick={() => sendPrompt(p.text)}
              className={`w-full text-left rounded-xl border px-4 py-3 shadow-sm transition-all hover:border-indigo-500/50 hover:shadow-indigo-500/5 active:scale-[0.98] ${cardBg}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none mt-0.5">{p.icon}</span>
                <p className={`text-xs leading-relaxed ${textBody}`}>{p.text}</p>
              </div>
            </button>
          ))}
          <p className={`text-[11px] pt-1 leading-relaxed ${textMuted}`}>
            Click to send directly →
          </p>
        </div>

        {/* Centre — live agent */}
        <div className="flex justify-center flex-1">
          <div className="relative" style={{ width: 340, height: 520 }}>
            {widgetOpen ? (
              <>
                <div
                  className="absolute inset-0 rounded-2xl blur-3xl scale-90 pointer-events-none"
                  style={{ background: "rgba(99,102,241,0.14)" }}
                />
                <div
                  className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl"
                  style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(99,102,241,0.12)" }}
                >
                  <ErrorBoundary>
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center bg-zinc-950 text-white/40 text-sm">
                          Loading…
                        </div>
                      }
                    >
                      <WidgetApp onClose={() => setWidgetOpen(false)} />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </>
            ) : (
              // Collapsed to the floating launcher, exactly like a live embed.
              <button
                onClick={() => setWidgetOpen(true)}
                aria-label="Open chat"
                className="absolute bottom-0 right-0 flex size-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <MessageCircle className="size-6 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Right — highlights + checklist */}
        <div className="lg:w-56 w-full shrink-0 space-y-3">
          <p className={`text-[11px] font-semibold uppercase tracking-widest mb-4 ${textMuted}`}>
            What it does
          </p>

          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className={`rounded-xl border p-4 shadow-sm ${cardBg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <p className={`text-xs font-semibold ${textPrimary}`}>{title}</p>
              </div>
              <p className={`text-xs leading-relaxed ${textBody}`}>{body}</p>
            </div>
          ))}

          <div className={`rounded-xl border p-4 ${checklistBg}`}>
            <p className={`text-xs font-semibold mb-2 ${checklistTitle}`}>Before going live</p>
            <ul className="space-y-1.5">
              {["Answers match your docs", "Failed tx question works", "Branding looks right"].map((item) => (
                <li key={item} className={`flex items-start gap-2 text-xs ${checklistText}`}>
                  <CheckCircle2 className={`w-3 h-3 shrink-0 mt-0.5 ${checklistIcon}`} />
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
