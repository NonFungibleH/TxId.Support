import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "TxID Support — AI-Powered Web3 Support Widget"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0b0c14",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 100px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle gradient orb */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
          }}
        />

        {/* Tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 32,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#6366f1" }} />
          <span style={{ color: "#6366f1", fontSize: 16, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
            TxID Support
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
            marginBottom: 28,
            maxWidth: 800,
          }}
        >
          AI support for DeFi protocols
        </div>

        {/* Subheadline */}
        <div style={{ fontSize: 24, color: "#6b7280", maxWidth: 700, lineHeight: 1.5 }}>
          The first support widget that already knows what your user&apos;s wallet did. Embed in 30 seconds.
        </div>

        {/* Bottom badge */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 100,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 12,
            padding: "10px 20px",
            color: "#a5b4fc",
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          Free — 200 conversations/month
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
