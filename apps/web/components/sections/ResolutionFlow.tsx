/**
 * The homepage hero: the product's actual argument, drawn.
 *
 * Every chain, wallet and contract describes failure in its own dialect. The
 * left of this graphic is that reality, using REAL strings we decode in
 * production, deliberately ragged and low contrast. They cross a lit seam,
 * which is the resolution layer, and one structured answer comes out.
 *
 * Real strings rather than lorem because a developer recognises them instantly,
 * and recognising them is the moment the claim lands. Teal appears exactly once,
 * on "verified", which is the rule the palette sets for it.
 *
 * SVG, not an image: it re-themes from the tokens, stays crisp at any size, and
 * costs a few KB. All motion is CSS and stops under prefers-reduced-motion.
 */

/** Real aborts, reverts and panics the decoder handles. Varied on purpose. */
const FRAGMENTS = [
  { t: "Move abort 0x10010", w: 132 },
  { t: "execution reverted", w: 126 },
  { t: "EORDER_NOT_FOUND", w: 138 },
  { t: "0x08c379a0…", w: 90 },
  { t: "TRANSFER_FROM_FAILED", w: 158 },
  { t: "EOBJECT_DOES_NOT_EXIST", w: 168 },
  { t: "Panic(0x11)", w: 84 },
  { t: "INSUFFICIENT_OUTPUT", w: 148 },
  { t: "0x1::coin 0x60002", w: 124 },
]

/** The Resolution Object's own fields. */
const ROWS = [
  { k: "category", v: "SETTLEMENT", teal: false },
  { k: "status", v: "failed", teal: false },
  { k: "custody", v: "funds with user", teal: false },
  { k: "next action", v: "user", teal: false },
  { k: "basis", v: "verified", teal: true },
]

export function ResolutionFlow({ className }: { className?: string }) {
  const SEAM = 268
  const CARD_X = 330

  return (
    <svg
      viewBox="0 0 660 470"
      className={className}
      role="img"
      aria-label="Raw failure messages from many chains resolving into one structured TxID answer"
    >
      <defs>
        <linearGradient id="rf-seam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="18%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="82%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rf-card" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--bg-elevated)" />
          <stop offset="100%" stopColor="var(--bg-surface)" />
        </linearGradient>
        {/* Fragments dissolve as they reach the seam rather than crossing it. */}
        <linearGradient id="rf-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="22%" stopColor="#fff" stopOpacity="1" />
          <stop offset="76%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="rf-mask">
          <rect x="0" y="0" width={SEAM} height="470" fill="url(#rf-fade)" />
        </mask>
        <filter id="rf-glow" x="-80%" y="-30%" width="260%" height="160%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <style>{`
        .rf-drift { animation: rf-drift 9s linear infinite; }
        .rf-seam  { animation: rf-seam 3.6s ease-in-out infinite; transform-origin: center; }
        .rf-spark { animation: rf-spark 3.6s ease-in-out infinite; }
        .rf-row   { animation: rf-row 3.6s ease-in-out infinite; }
        @keyframes rf-drift {
          from { transform: translateX(-40px); }
          to   { transform: translateX(232px); }
        }
        @keyframes rf-seam {
          0%, 100% { opacity: .55; transform: scaleY(.96); }
          50%      { opacity: 1;   transform: scaleY(1); }
        }
        @keyframes rf-spark {
          0%, 100% { opacity: 0; transform: translateY(0); }
          45%      { opacity: 1; }
          70%      { opacity: 0; transform: translateY(-14px); }
        }
        @keyframes rf-row {
          0%, 100% { opacity: .72; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rf-drift, .rf-seam, .rf-spark, .rf-row { animation: none; }
          .rf-drift { transform: translateX(96px); }
        }
      `}</style>

      {/* ── The dialects ──────────────────────────────────────────────────── */}
      <g mask="url(#rf-mask)">
        {FRAGMENTS.map((f, i) => {
          const y = 34 + i * 46
          const delay = -(i * 1.05)
          return (
            <g key={f.t} className="rf-drift" style={{ animationDelay: `${delay}s` }}>
              <rect x="0" y={y - 13} width={f.w} height="24" rx="6"
                fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="1" />
              <circle cx="12" cy={y - 1} r="2.5" fill="var(--accent-soft)" fillOpacity="0.75" />
              <text x="24" y={y + 3} fill="var(--text-subtle)" fontSize="11"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{f.t}</text>
            </g>
          )
        })}
      </g>

      {/* ── The layer ─────────────────────────────────────────────────────── */}
      <g>
        <rect className="rf-seam" x={SEAM - 1.5} y="10" width="3" height="450"
          fill="url(#rf-seam)" filter="url(#rf-glow)" />
        <text x={SEAM} y="470" textAnchor="middle" fill="var(--text-muted)" fontSize="10"
          letterSpacing="2.5" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
          TXID
        </text>
        {[0, 1, 2, 3].map(i => (
          <circle key={i} className="rf-spark" style={{ animationDelay: `${i * 0.9}s` }}
            cx={SEAM} cy={90 + i * 96} r="3" fill="var(--accent)" />
        ))}
      </g>

      {/* ── One answer ────────────────────────────────────────────────────── */}
      <g transform={`translate(${CARD_X}, 96)`}>
        <rect width="300" height="252" rx="16" fill="url(#rf-card)"
          stroke="var(--border-accent)" strokeWidth="1.2" />

        <text x="22" y="34" fill="var(--text-muted)" fontSize="10" letterSpacing="2"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">RESOLUTION</text>
        <rect x="228" y="20" width="52" height="20" rx="6" fill="var(--accent-muted)" />
        <text x="254" y="34" textAnchor="middle" fill="var(--accent)" fontSize="11" fontWeight="700"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">7201</text>

        <line x1="22" y1="52" x2="278" y2="52" stroke="var(--border)" strokeWidth="1" />

        {ROWS.map((r, i) => (
          <g key={r.k} className="rf-row" style={{ animationDelay: `${i * 0.24}s` }}>
            <text x="22" y={80 + i * 34} fill="var(--text-subtle)" fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{r.k}</text>
            <text x="278" y={80 + i * 34} textAnchor="end"
              fill={r.teal ? "var(--teal)" : "var(--text-primary)"}
              fontSize="12.5" fontWeight={r.teal ? 700 : 600}>{r.v}</text>
          </g>
        ))}

        <line x1="22" y1="228" x2="278" y2="228" stroke="var(--border)" strokeWidth="1" />
        <text x="22" y="245" fill="var(--text-subtle)" fontSize="10"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
          every field carries its evidence
        </text>
      </g>
    </svg>
  )
}
