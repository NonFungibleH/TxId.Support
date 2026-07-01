import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "TxID Support: AI Support Agent for DeFi Protocols"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const CHAINS = [
  { name: "ETH",   color: "#627EEA" },
  { name: "BASE",  color: "#0052FF" },
  { name: "ARB",   color: "#28A0F0" },
  { name: "MATIC", color: "#8247E5" },
  { name: "OP",    color: "#FF0420" },
  { name: "BNB",   color: "#F3BA2F" },
]

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0b0c14",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background gradient orb */}
        <div
          style={{
            position: "absolute",
            top: 315,
            left: 384,
            width: 700,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, transparent 70%)",
            transform: "translate(-50%, -50%)",
            display: "flex",
          }}
        />

        {/* Left column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "72px 56px 72px 96px",
            flex: 1,
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
            <div style={{ width: 9, height: 9, borderRadius: 5, background: "#6366f1", display: "flex" }} />
            <span style={{ color: "#6366f1", fontSize: 15, fontWeight: 700, letterSpacing: 3 }}>
              TXID.SUPPORT
            </span>
          </div>

          {/* Headline — flex column avoids <br> which is unsupported */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 22 }}>
            <span style={{ fontSize: 50, fontWeight: 800, color: "#ffffff", lineHeight: 1.1, letterSpacing: "-0.5px" }}>
              Expert support for every user.
            </span>
            <span style={{ fontSize: 50, fontWeight: 800, color: "#6366f1", lineHeight: 1.1, letterSpacing: "-0.5px" }}>
              No support team needed.
            </span>
          </div>

          {/* Subline */}
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#6b7280",
              lineHeight: 1.6,
              marginBottom: 40,
              maxWidth: 430,
            }}
          >
            <span>AI that knows your protocol inside out: wallets, transactions, and docs.</span>
          </div>

          {/* Chain badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#374151", fontSize: 12, marginRight: 4 }}>Available on</span>
            {CHAINS.map(({ name, color }) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  background: `${color}18`,
                  border: `1px solid ${color}38`,
                  borderRadius: 20,
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  color,
                  letterSpacing: 0.5,
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Right column — widget mockup */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "56px 88px 56px 24px",
            width: 380,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 268,
              height: 430,
              background: "#13141f",
              borderRadius: 22,
              border: "1px solid rgba(99,102,241,0.22)",
              overflow: "hidden",
              boxShadow: "0 0 80px rgba(99,102,241,0.18), 0 32px 64px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 18px",
                background: "#6366f1",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: "rgba(255,255,255,0.22)",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "white",
                }}
              >
                AI
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>Protocol Support</span>
                <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>Powered by txid.support</span>
              </div>
            </div>

            {/* Chat area */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "14px",
                gap: 10,
                flex: 1,
              }}
            >
              {/* AI opener */}
              <div
                style={{
                  display: "flex",
                  background: "#1a1b2e",
                  borderRadius: "4px 12px 12px 12px",
                  border: "1px solid rgba(99,102,241,0.14)",
                  padding: "9px 12px",
                  fontSize: 10.5,
                  color: "#c9d1e0",
                  lineHeight: 1.55,
                  maxWidth: "85%",
                }}
              >
                I can see 4,200 USDC staked. How can I help?
              </div>

              {/* User message */}
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-end",
                  background: "#6366f1",
                  borderRadius: "12px 4px 12px 12px",
                  padding: "9px 12px",
                  fontSize: 10.5,
                  color: "white",
                  lineHeight: 1.55,
                  maxWidth: "80%",
                }}
              >
                Why did my tx fail?
              </div>

              {/* AI reply */}
              <div
                style={{
                  display: "flex",
                  background: "#1a1b2e",
                  borderRadius: "4px 12px 12px 12px",
                  border: "1px solid rgba(99,102,241,0.14)",
                  padding: "9px 12px",
                  fontSize: 10.5,
                  color: "#c9d1e0",
                  lineHeight: 1.55,
                  maxWidth: "90%",
                }}
              >
                SlippageTooHigh: rate moved 0.8% before confirmation. Try 1% slippage tolerance.
              </div>

              {/* Typing dots */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px" }}>
                <div style={{ display: "flex", width: 6, height: 6, borderRadius: 3, background: "rgba(99,102,241,0.3)" }} />
                <div style={{ display: "flex", width: 6, height: 6, borderRadius: 3, background: "rgba(99,102,241,0.55)" }} />
                <div style={{ display: "flex", width: 6, height: 6, borderRadius: 3, background: "rgba(99,102,241,0.8)" }} />
              </div>
            </div>

            {/* Input row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 12px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  height: 30,
                  background: "#1a1b2e",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.07)",
                  paddingLeft: 10,
                }}
              >
                <span style={{ color: "#374151", fontSize: 10 }}>Ask anything…</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  background: "#6366f1",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                ↑
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
