import { ImageResponse } from "next/og"
import { getPost, POSTS } from "@/lib/posts"

export const runtime = "edge"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export async function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }))
}

export default function Image({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  const title = post?.title ?? "TxID Support Blog"
  const tag = post?.tags[0] ?? "Web3 Support"

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
        {/* Gradient orb */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -60,
            width: 450,
            height: 450,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
          }}
        />

        {/* Tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 6,
              padding: "4px 12px",
              color: "#a5b4fc",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            {tag}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 50 ? 52 : 60,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.15,
            marginBottom: 40,
            maxWidth: 900,
          }}
        >
          {title}
        </div>

        {/* Attribution */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#6366f1" }} />
          <span style={{ color: "#6b7280", fontSize: 16, fontWeight: 500 }}>
            TxID Support · txid.support/blog
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
