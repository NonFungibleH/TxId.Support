import { ImageResponse } from "next/og"

// Co-branded share card for the Team Finance pitch page. Light, Team Finance
// blue, echoing the hero: "You secured your token…" plus a resolved case card.
export const runtime = "edge"
export const alt = "TxID for Team Finance: custom-branded on-chain support that investigates what happened"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const BLUE = "#1863DC"
const INK = "#101223"
const BODY = "#4B5063"

const RAIL = [
  "Fetched transaction",
  "Replayed against pool state",
  "Read lock & vesting schedule",
  "Checked wallet impact",
]

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#F7F8FC",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Soft brand orb */}
        <div
          style={{
            position: "absolute",
            top: -140,
            right: -120,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(24,99,220,0.14) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Left column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "72px 40px 72px 88px",
            flex: 1,
          }}
        >
          {/* Co-brand lockup */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: BLUE, letterSpacing: 0.2 }}>Team Finance</span>
            <div style={{ display: "flex", width: 1, height: 20, background: "#C9D0E0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", width: 22, height: 22, borderRadius: 6, background: BLUE }} />
              <span style={{ fontSize: 20, fontWeight: 700, color: INK }}>TxID</span>
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 22 }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: INK, lineHeight: 1.08, letterSpacing: "-1px" }}>
              You secured your token.
            </span>
            <span style={{ fontSize: 52, fontWeight: 800, color: BLUE, lineHeight: 1.12, letterSpacing: "-1px" }}>
              Now give your holders answers.
            </span>
          </div>

          {/* Subline */}
          <div style={{ display: "flex", fontSize: 20, color: BODY, lineHeight: 1.55, marginBottom: 36, maxWidth: 520 }}>
            <span>A custom-branded support agent that investigates failed transactions and answers holders 24/7, in your branding.</span>
          </div>

          {/* Compliance chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {["Read-only", "No custody", "Audit-logged"].map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  background: "#EAF1FC",
                  border: "1px solid #D3E2FB",
                  borderRadius: 20,
                  padding: "7px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: BLUE,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* Right column: resolved case card */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "72px 80px 72px 16px", width: 470 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 360,
              background: "#101223",
              borderRadius: 20,
              padding: 22,
              boxShadow: "0 40px 80px -30px rgba(16,18,35,0.55)",
            }}
          >
            {/* Card header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Case #4821</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: "rgba(34,160,107,0.16)",
                  borderRadius: 20,
                  padding: "5px 12px",
                }}
              >
                <div style={{ display: "flex", width: 7, height: 7, borderRadius: 4, background: "#22A06B" }} />
                <span style={{ color: "#4ED9A0", fontSize: 12, fontWeight: 600 }}>Resolved</span>
              </div>
            </div>

            <span style={{ color: "#fff", fontSize: 17, fontWeight: 600, marginBottom: 16 }}>
              &ldquo;Why did my swap fail?&rdquo;
            </span>

            {/* Investigation rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {RAIL.map((r) => (
                <div
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#1B1E30",
                    borderRadius: 9,
                    padding: "9px 12px",
                  }}
                >
                  <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, border: `2px solid ${BLUE}` }} />
                  <span style={{ color: "#AEB4C6", fontSize: 12.5 }}>{r}</span>
                </div>
              ))}
            </div>

            {/* Answer */}
            <div
              style={{
                display: "flex",
                background: "rgba(24,99,220,0.12)",
                border: "1px solid rgba(24,99,220,0.35)",
                borderRadius: 10,
                padding: "12px 13px",
              }}
            >
              <span style={{ color: "#DCE4F5", fontSize: 12.5, lineHeight: 1.5 }}>
                The price moved past your 0.3% slippage tolerance, so the contract rejected the swap. No funds left your wallet.
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
