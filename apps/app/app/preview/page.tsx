import { Suspense } from "react"
import { WidgetApp } from "@/app/widget/WidgetApp"
import Link from "next/link"
import { ArrowLeft, Zap } from "lucide-react"

export const dynamic = "force-dynamic"

const EXAMPLE_PROMPTS = [
  "How do I swap tokens?",
  "Why did my transaction fail?",
  "How do I add liquidity?",
  "What are the fees?",
  "How do I connect my wallet?",
  "Is the smart contract audited?",
]

/**
 * Clean light-mode preview page. Lets dashboard users test their widget
 * exactly as it will appear — floating bottom-right — before going live.
 */
export default function PreviewPage() {
  return (
    <div
      className="min-h-screen font-sans"
      style={{ background: "#f8f9fb", color: "#111827" }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(248,249,251,0.9)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 24px",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/dashboard/preview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "#6b7280",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />
            Back to dashboard
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                background: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={11} color="white" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6366f1" }}>
              TxID Support
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#9ca3af",
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                borderRadius: 99,
                padding: "1px 8px",
                marginLeft: 4,
              }}
            >
              Preview mode
            </span>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "64px 24px 240px" }}>

        {/* Title */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            Widget Preview
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10, color: "#111827" }}>
            Test your support widget
          </h1>
          <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.6 }}>
            Your widget is live in the bottom-right corner — exactly where your users will see it.
            Try a few questions to make sure it&apos;s answering the way you&apos;d expect.
          </p>
        </div>

        {/* Example prompts */}
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "24px 28px",
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
            Try asking
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EXAMPLE_PROMPTS.map((prompt) => (
              <span
                key={prompt}
                style={{
                  display: "inline-block",
                  fontSize: 13,
                  color: "#374151",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 99,
                  padding: "6px 14px",
                  cursor: "default",
                }}
              >
                {prompt}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 16 }}>
            Type any of these into the chat widget →
          </p>
        </div>

        {/* Tips */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 12,
            padding: "16px 20px",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
            Before going live
          </p>
          <ul style={{ fontSize: 13, color: "#78350f", lineHeight: 1.7, paddingLeft: 16, margin: 0 }}>
            <li>Check that answers reflect your actual documentation</li>
            <li>Test a failed transaction question if you&apos;ve added contract addresses</li>
            <li>If answers seem generic, add more docs in the <strong>Docs & KB</strong> section</li>
          </ul>
        </div>
      </main>

      {/* ── Widget — fixed bottom-right, exactly as it will appear in production ── */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 380,
          height: 580,
          borderRadius: 18,
          overflow: "hidden",
          zIndex: 40,
          boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(99,102,241,0.12)",
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#f9fafb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              Loading widget…
            </div>
          }
        >
          <WidgetApp />
        </Suspense>
      </div>
    </div>
  )
}
