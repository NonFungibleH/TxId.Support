/**
 * The homepage hero: TxID as a layer sitting above the chains.
 *
 * Two earlier attempts failed for the same reason and it is worth recording:
 * both were sparse line-art. Thin strokes, small type and lots of air read as
 * unfinished at hero size, however correct the idea was. What works here is
 * density and depth, so this is built as solid lit slabs with real thickness,
 * spaced so they OVERLAP into one object rather than floating apart as three
 * separate plates.
 *
 * SVG rather than an image: it re-themes from the tokens, stays crisp at any
 * size, and costs a few KB. Motion is CSS only and stops under
 * prefers-reduced-motion.
 */
export function LayerStack({ className }: { className?: string }) {
  const CX = 300
  const HW = 212          // half width
  const HH = 106          // half height, 2:1 against HW, which is what makes it isometric
  const D = 26            // slab thickness
  const GAP = 132         // < 2*HH on purpose: the slabs interlock

  const TOP = 150
  const MID = TOP + GAP
  const BOT = MID + GAP

  const face = (cy: number) => `${CX},${cy - HH} ${CX + HW},${cy} ${CX},${cy + HH} ${CX - HW},${cy}`
  const left = (cy: number) => `${CX - HW},${cy} ${CX},${cy + HH} ${CX},${cy + HH + D} ${CX - HW},${cy + D}`
  const right = (cy: number) => `${CX},${cy + HH} ${CX + HW},${cy} ${CX + HW},${cy + D} ${CX},${cy + HH + D}`

  const Slab = ({ cy, tone, glow }: { cy: number; tone: 1 | 2 | 3; glow?: boolean }) => (
    <g>
      <polygon points={left(cy)} fill={`url(#ls-side-${tone})`} />
      <polygon points={right(cy)} fill={`url(#ls-sideb-${tone})`} />
      <polygon points={face(cy)} fill={`url(#ls-top-${tone})`} {...(glow ? { filter: "url(#ls-glow)" } : {})} />
      <polygon points={face(cy)} fill="url(#ls-grid)" opacity={tone === 1 ? 0.5 : 0.3} />
      {/* Lit back edges: the single strongest depth cue at this angle. */}
      <path d={`M${CX - HW},${cy} L${CX},${cy - HH} L${CX + HW},${cy}`} fill="none"
        stroke={tone === 1 ? "var(--accent)" : "var(--accent-soft)"}
        strokeOpacity={tone === 1 ? 0.95 : 0.62} strokeWidth="1.6" />
      <path d={`M${CX - HW},${cy} L${CX},${cy + HH} L${CX + HW},${cy}`} fill="none"
        stroke={tone === 1 ? "var(--accent)" : "var(--accent-soft)"}
        strokeOpacity={tone === 1 ? 0.5 : 0.22} strokeWidth="1.2" />
    </g>
  )

  const Motes = ({ from }: { from: number }) => (
    <g>
      {[0, 1, 2, 3, 4].map(i => {
        const x = CX - 74 + i * 37
        return (
          <rect key={i} className="ls-rise" style={{ animationDelay: `${i * 0.62}s` }}
            x={x} y={from - HH * 0.35} width="2.5" height="16" rx="1.25" fill="var(--accent)" />
        )
      })}
    </g>
  )

  return (
    <svg viewBox="0 0 640 620" className={className} role="img"
      aria-label="The TxID resolution layer sitting above on-chain data and the blockchains beneath it">
      <defs>
        {/* Tone 1 = the TxID layer, brightest. 2 and 3 recede. */}
        <linearGradient id="ls-top-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4b47e9" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#3734d2" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#2a78b0" stopOpacity="0.62" />
        </linearGradient>
        <linearGradient id="ls-top-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4453b4" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#2b3a86" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="ls-top-3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#333f80" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#212c5f" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="ls-side-1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2799" /><stop offset="100%" stopColor="#141243" />
        </linearGradient>
        <linearGradient id="ls-sideb-1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d1b74" /><stop offset="100%" stopColor="#0d0c2e" />
        </linearGradient>
        <linearGradient id="ls-side-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a3573" /><stop offset="100%" stopColor="#141a44" />
        </linearGradient>
        <linearGradient id="ls-sideb-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2758" /><stop offset="100%" stopColor="#0e1230" />
        </linearGradient>
        <linearGradient id="ls-side-3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f2856" /><stop offset="100%" stopColor="#0d1130" />
        </linearGradient>
        <linearGradient id="ls-sideb-3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#171e45" /><stop offset="100%" stopColor="#0a0d26" />
        </linearGradient>
        <radialGradient id="ls-ground">
          <stop offset="0%" stopColor="#4b47e9" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#4b47e9" stopOpacity="0" />
        </radialGradient>
        <pattern id="ls-grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <path d="M26 0H0V26" fill="none" stroke="#8f96be" strokeOpacity="0.16" strokeWidth="0.6" />
        </pattern>
        <filter id="ls-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ls-cardshadow" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#02030c" floodOpacity="0.7" />
        </filter>
      </defs>

      <style>{`
        .ls-rise { animation: ls-rise 2.9s ease-in-out infinite; }
        .ls-float { animation: ls-float 9s ease-in-out infinite; }
        .ls-pulse { animation: ls-pulse 4.2s ease-in-out infinite; }
        @keyframes ls-rise {
          0%   { transform: translateY(0);     opacity: 0; }
          25%  { opacity: .95; }
          100% { transform: translateY(-108px); opacity: 0; }
        }
        @keyframes ls-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        @keyframes ls-pulse { 0%,100% { opacity: .45 } 50% { opacity: .9 } }
        @media (prefers-reduced-motion: reduce) {
          .ls-rise, .ls-float, .ls-pulse { animation: none }
        }
      `}</style>

      <ellipse className="ls-pulse" cx={CX} cy={BOT + 74} rx="250" ry="62" fill="url(#ls-ground)" />

      <g>
        <Slab cy={BOT} tone={3} />
        <line x1={CX + 128} y1={BOT} x2={CX + 186} y2={BOT} stroke="#8f96be" strokeOpacity="0.35" strokeWidth="1" />
        <text x={CX + 196} y={BOT + 5} fill="#8d93ad" fontSize="16" fontWeight="600">Blockchains</text>
      </g>

      <Motes from={MID + HH} />

      <g>
        <Slab cy={MID} tone={2} />
        <line x1={CX + 128} y1={MID} x2={CX + 186} y2={MID} stroke="#8f96be" strokeOpacity="0.45" strokeWidth="1" />
        <text x={CX + 196} y={MID + 5} fill="#b6bad2" fontSize="16" fontWeight="600">On-chain data</text>
      </g>

      <Motes from={TOP + HH} />

      <g className="ls-float">
        <Slab cy={TOP} tone={1} glow />

        {/* The card sits ON the lit face, close enough to read as one piece. */}
        <g transform={`translate(${CX - 132}, ${TOP - 74})`} filter="url(#ls-cardshadow)">
          <rect width="264" height="150" rx="14" fill="#10162e" stroke="#4b47e9" strokeOpacity="0.55" strokeWidth="1.2" />
          <rect x="18" y="17" width="26" height="26" rx="8" fill="#4b47e9" />
          <path d="M23.5 30 h3.6 l2.4 -6 l3 12 l2.4 -6 h2.4" fill="none" stroke="#fff" strokeWidth="1.9"
            strokeLinecap="round" strokeLinejoin="round" />
          <text x="52" y="35" fill="#f7f7fa" fontSize="14.5" fontWeight="700">TxID Resolution Layer</text>
          {["Standard diagnosis", "Funds and next action", "Evidence for every answer", "Auditable case record"]
            .map((t, i) => (
              <g key={t} transform={`translate(20, ${62 + i * 21})`}>
                <circle cx="6" cy="6" r="6" fill="none" stroke="#16c7ae" strokeOpacity="0.85" strokeWidth="1.3" />
                <path d="M3.3 6.2 L5.3 8.2 L9 4.5" fill="none" stroke="#16c7ae" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
                <text x="20" y="10" fill="#b6bad2" fontSize="12">{t}</text>
              </g>
            ))}
        </g>
      </g>
    </svg>
  )
}
