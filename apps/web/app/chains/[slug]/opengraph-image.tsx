import { ImageResponse } from "next/og"
import { VISIBLE_CHAINS, getChain, hexToRgba } from "@/lib/chains"

// Chain-branded share card: these pages are sent to chain ecosystem teams, so
// the preview has to read as "TxID x <chain>", not the generic site card the
// root image provides. Same 1200x630 dark frame as the blog cards.

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export async function generateStaticParams() {
  return VISIBLE_CHAINS.map((c) => ({ slug: c.slug }))
}

export default function Image({ params }: { params: { slug: string } }) {
  const chain = getChain(params.slug)
  const name = chain?.name ?? "Web3"
  const color = chain?.color ?? "#4b47e9"
  const isLive = chain?.status === "live"

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
          overflow: "hidden",
        }}
      >
        {/* Chain-coloured gradient orb */}
        <div
          style={{
            position: "absolute",
            top: -140,
            right: -100,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${hexToRgba(color, 0.28)} 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -180,
            left: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${hexToRgba(color, 0.14)} 0%, transparent 70%)`,
          }}
        />

        {/* Lockup: chain x TxID + status pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: 26,
              background: hexToRgba(color, 0.15),
              border: `2px solid ${hexToRgba(color, 0.5)}`,
              color,
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            {name.slice(0, 1)}
          </div>
          <span style={{ color: "#ffffff", fontSize: 30, fontWeight: 700 }}>{name}</span>
          <span style={{ color: "#4b5563", fontSize: 26 }}>×</span>
          <span style={{ color: "#ffffff", fontSize: 30, fontWeight: 800 }}>TxID</span>
          <span
            style={{
              marginLeft: 10,
              background: hexToRgba(color, 0.12),
              border: `1px solid ${hexToRgba(color, 0.4)}`,
              borderRadius: 999,
              padding: "6px 16px",
              color,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {isLive ? "Live" : "Coming soon"}
          </span>
        </div>

        {/* Headline, matching the page hero */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.12,
            maxWidth: 950,
            marginBottom: 36,
          }}
        >
          <span>Expert support for</span>
          <span style={{ display: "flex", gap: 18 }}>
            every <span style={{ color }}>{name}</span> user.
          </span>
        </div>

        {/* Attribution */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
          <span style={{ color: "#6b7280", fontSize: 18, fontWeight: 500 }}>
            txid.support/chains/{params.slug}
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
