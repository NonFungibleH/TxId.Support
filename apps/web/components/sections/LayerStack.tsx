/**
 * The homepage hero graphic: TxID as a layer sitting above the chains.
 *
 * Built as SVG rather than a rendered image on purpose. It re-themes from the
 * CSS tokens (so a palette change moves it too), stays crisp at any size,
 * costs a few KB instead of a megabyte, and can carry motion, which is what
 * makes it read as infrastructure rather than a diagram.
 *
 * The beams travel UPWARD, which is the direction the product actually runs:
 * chain data rises into the resolution layer, and an answer comes out of the
 * top. Motion is CSS-only and respects prefers-reduced-motion.
 */
export function LayerStack({ className }: { className?: string }) {
  // Geometry lives in constants so the three slabs cannot drift apart.
  const CX = 230
  const HALF_W = 200
  const HALF_H = 100        // 2:1 against HALF_W, which is what makes it isometric
  const DEPTH = 16          // the extruded edge: without it a slab reads as an outline
  const GAP = 250

  const TOP = 130
  const MID = TOP + GAP
  const BOT = MID + GAP

  const face = (cy: number) =>
    `${CX},${cy - HALF_H} ${CX + HALF_W},${cy} ${CX},${cy + HALF_H} ${CX - HALF_W},${cy}`
  const edgeLeft = (cy: number) =>
    `${CX - HALF_W},${cy} ${CX},${cy + HALF_H} ${CX},${cy + HALF_H + DEPTH} ${CX - HALF_W},${cy + DEPTH}`
  const edgeRight = (cy: number) =>
    `${CX},${cy + HALF_H} ${CX + HALF_W},${cy} ${CX + HALF_W},${cy + DEPTH} ${CX},${cy + HALF_H + DEPTH}`

  /** Beam x-positions, spread across the middle of the plate. */
  const LANES = Array.from({ length: 7 }, (_, i) => {
    const t = (i + 1) / 8
    return { x: CX - HALF_W * 0.58 + t * HALF_W * 1.16, delay: ((i * 397) % 1000) / 1000 }
  })

  const Slab = ({
    cy, fill, stroke, glow = false,
  }: { cy: number; fill: string; stroke: string; glow?: boolean }) => (
    <>
      <polygon points={edgeLeft(cy)} fill="var(--bg-base)" fillOpacity="0.92" stroke={stroke} strokeOpacity="0.35" strokeWidth="1" />
      <polygon points={edgeRight(cy)} fill="var(--bg-deep)" fillOpacity="0.92" stroke={stroke} strokeOpacity="0.35" strokeWidth="1" />
      <polygon points={face(cy)} fill={fill} stroke={stroke} strokeOpacity="0.8" strokeWidth="1.4" {...(glow ? { filter: "url(#ls-glow)" } : {})} />
      <polygon points={face(cy)} fill="url(#ls-grid)" opacity="0.55" />
    </>
  )

  const Beams = ({ from }: { from: number }) => (
    <g>
      {LANES.map(({ x }, i) => (
        <line key={`r${i}`} x1={x} y1={from} x2={x} y2={from - GAP} stroke="var(--accent-soft)" strokeOpacity="0.16" strokeWidth="1" />
      ))}
      {LANES.map(({ x, delay }, i) => (
        <rect key={`b${i}`} className="ls-rise" style={{ animationDelay: `${delay * 3.2}s` }}
          x={x - 1.25} y={from - 40} width="2.5" height="40" rx="1.25" fill="url(#ls-beam)" />
      ))}
    </g>
  )

  return (
    <svg
      viewBox="0 0 596 780"
      className={className}
      role="img"
      aria-label="TxID resolution layer sitting above on-chain data and the blockchains beneath it"
    >
      <defs>
        <linearGradient id="ls-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="52%" stopColor="var(--accent-cool)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.44" />
        </linearGradient>
        <linearGradient id="ls-mid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-cool)" stopOpacity="0.38" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="ls-bot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-cool)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--accent-soft)" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="ls-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="1" />
        </linearGradient>
        <filter id="ls-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* The faint lattice on each slab: reads as structure, not decoration. */}
        <pattern id="ls-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="var(--accent-soft)" strokeOpacity="0.2" strokeWidth="0.6" />
        </pattern>
      </defs>

      <style>{`
        .ls-rise { animation: ls-rise 3.2s cubic-bezier(.45,0,.55,1) infinite; }
        .ls-float-1 { animation: ls-float 8s ease-in-out infinite; }
        .ls-float-2 { animation: ls-float 8s ease-in-out infinite .6s; }
        .ls-float-3 { animation: ls-float 8s ease-in-out infinite 1.2s; }
        .ls-pulse { animation: ls-pulse 4s ease-in-out infinite; }
        @keyframes ls-rise {
          from { transform: translateY(0); opacity: 0; }
          14%  { opacity: 1; }
          86%  { opacity: 1; }
          to   { transform: translateY(-${GAP}px); opacity: 0; }
        }
        @keyframes ls-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes ls-pulse { 0%, 100% { opacity: .5 } 50% { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          .ls-rise, .ls-float-1, .ls-float-2, .ls-float-3, .ls-pulse { animation: none }
        }
      `}</style>

      {/* ── Blockchains ───────────────────────────────────────────────────── */}
      <g className="ls-float-3">
        <Slab cy={BOT} fill="url(#ls-bot)" stroke="var(--accent-soft)" />
        {/* A stack of ledgers, drawn as receding ellipses. */}
        {[0, 8, 16].map(o => (
          <ellipse key={o} cx={CX} cy={BOT + 8 - o} rx="38" ry="17"
            fill="var(--accent-cool)" fillOpacity={0.2 + o * 0.02}
            stroke="var(--accent-cool)" strokeOpacity="0.7" strokeWidth="1" />
        ))}
        <line x1={CX + HALF_W * 0.34} y1={BOT} x2={430} y2={BOT} stroke="var(--accent-soft)" strokeOpacity="0.5" strokeWidth="1" />
        <text x={440} y={BOT + 6} fill="var(--text-primary)" fontSize="19" fontWeight="600" opacity="0.9">Blockchains</text>
      </g>

      <Beams from={BOT} />

      {/* ── On-chain data ─────────────────────────────────────────────────── */}
      <g className="ls-float-2">
        <Slab cy={MID} fill="url(#ls-mid)" stroke="var(--accent-cool)" />
        {/* One lit block: the transaction being read. */}
        <g className="ls-pulse">
          <polygon points={`${CX},${MID - 30} ${CX + 34},${MID - 11} ${CX},${MID + 8} ${CX - 34},${MID - 11}`} fill="var(--accent)" fillOpacity="0.95" />
          <polygon points={`${CX - 34},${MID - 11} ${CX},${MID + 8} ${CX},${MID + 38} ${CX - 34},${MID + 19}`} fill="var(--accent-hover)" fillOpacity="0.9" />
          <polygon points={`${CX + 34},${MID - 11} ${CX},${MID + 8} ${CX},${MID + 38} ${CX + 34},${MID + 19}`} fill="var(--accent-cool)" fillOpacity="0.85" />
        </g>
        <line x1={CX + HALF_W * 0.34} y1={MID} x2={430} y2={MID} stroke="var(--accent-cool)" strokeOpacity="0.5" strokeWidth="1" />
        <text x={440} y={MID + 6} fill="var(--text-primary)" fontSize="19" fontWeight="600" opacity="0.9">On-chain data</text>
      </g>

      <Beams from={MID} />

      {/* ── The resolution layer ──────────────────────────────────────────── */}
      <g className="ls-float-1">
        <Slab cy={TOP} fill="url(#ls-top)" stroke="var(--accent)" glow />

        {/* Sized to leave the slab's front face and both tips visible: the card
            must sit ON the layer, not replace it. */}
        <g transform={`translate(${CX - 122}, ${TOP - 100})`}>
          <rect width="244" height="146" rx="14" fill="var(--bg-elevated)" fillOpacity="0.97" stroke="var(--border-accent)" strokeWidth="1.2" />
          <rect x="17" y="17" width="25" height="25" rx="8" fill="var(--accent)" />
          <path d="M22.5 29.5 h3.6 l2.3 -5.8 l2.9 11.6 l2.3 -5.8 h2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <text x="50" y="35" fill="var(--text-primary)" fontSize="14" fontWeight="700">TxID Resolution Layer</text>
          {[
            "Standard diagnosis",
            "Funds and next action",
            "Evidence for every answer",
            "Auditable case record",
          ].map((label, i) => (
            <g key={label} transform={`translate(19, ${60 + i * 21})`}>
              <circle cx="6" cy="6" r="6" fill="none" stroke="var(--teal)" strokeOpacity="0.9" strokeWidth="1.3" />
              <path d="M3.2 6.2 L5.2 8.2 L9 4.4" fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="20" y="10" fill="var(--text-muted)" fontSize="12.5">{label}</text>
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}
