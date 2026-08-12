// Inline SVG figures for blog articles. Each is self-contained, theme-consistent
// (uses the site's CSS tokens for neutrals + the brand indigo for accent) and
// scales to its container. Add a new diagram by giving it a `kind` and a case
// in Figure(). Keep them small and legible: a figure earns its place by making
// a process visible, not by decorating the page.

const ACCENT = "#6366f1"
const DANGER = "#ef4444"
const SUCCESS = "#34d399"

/** The decoder's fallback ladder: a failed transaction becomes a plain answer. */
function DecodeFlow() {
  const rungs = [
    { n: "1", label: "Out of gas?", sub: "gas used reaches the gas limit" },
    { n: "2", label: "Revert reason?", sub: "Error(string), replayed on-chain" },
    { n: "3", label: "Custom error or panic?", sub: "decoded with the contract ABI" },
    { n: "4", label: "Signature lookup", sub: "4byte.directory as a last resort" },
  ]
  const rowH = 56
  const gap = 12
  const rowStart = 96
  const chipCy = (i: number) => rowStart + i * (rowH + gap) + rowH / 2
  const ladderBottom = rowStart + (rungs.length - 1) * (rowH + gap) + rowH
  const outY = ladderBottom + 20

  return (
    <svg viewBox="0 0 640 480" width="100%" role="img"
      aria-label="How a failed transaction is decoded: out of gas, then revert reason, then custom error or panic, then a signature lookup, ending in a plain-English cause and fix."
      style={{ display: "block" }}>
      {/* Input: the failed transaction */}
      <rect x="160" y="8" width="320" height="60" rx="12" fill="var(--bg-surface)" stroke="var(--border)" />
      <circle cx="186" cy="32" r="5" fill={DANGER} />
      <text x="204" y="31" fill="#ffffff" fontSize="15" fontWeight="600">Failed transaction</text>
      <text x="204" y="50" fill="var(--text-muted)" fontSize="12" fontFamily="ui-monospace, monospace">0x9f3c…a12b reverted</text>

      {/* connector into the ladder */}
      <line x1="320" y1="68" x2="320" y2="86" stroke="var(--border)" strokeWidth="2" />
      <path d="M320 92 l-5 -7 h10 z" fill="var(--border)" />

      {/* rail behind the ladder */}
      <line x1="148" y1={chipCy(0)} x2="148" y2={chipCy(rungs.length - 1)} stroke="var(--border)" strokeWidth="2" />

      {/* the fallback ladder, tried in order until one explains it */}
      {rungs.map((r, i) => {
        const y = rowStart + i * (rowH + gap)
        const cy = chipCy(i)
        return (
          <g key={r.n}>
            <rect x="120" y={y} width="400" height={rowH} rx="10" fill="var(--bg-surface)" stroke="var(--border)" />
            <circle cx="148" cy={cy} r="13" fill="rgba(99,102,241,0.14)" stroke={ACCENT} strokeWidth="1.5" />
            <text x="148" y={cy + 4} fill={ACCENT} fontSize="12" fontWeight="700" textAnchor="middle">{r.n}</text>
            <text x="176" y={cy - 4} fill="#ffffff" fontSize="14" fontWeight="600">{r.label}</text>
            <text x="176" y={cy + 14} fill="var(--text-muted)" fontSize="12">{r.sub}</text>
          </g>
        )
      })}

      {/* connector to the answer */}
      <line x1="320" y1={ladderBottom} x2="320" y2={outY - 6} stroke="var(--border)" strokeWidth="2" />
      <path d={`M320 ${outY} l-5 -7 h10 z`} fill="var(--border)" />

      {/* Output: the plain-English answer */}
      <rect x="96" y={outY + 4} width="448" height="86" rx="12" fill="rgba(99,102,241,0.08)" stroke={ACCENT} strokeOpacity="0.5" />
      <circle cx="124" cy={outY + 30} r="9" fill="rgba(52,211,153,0.15)" />
      <path d={`M119.5 ${outY + 30} l3 3 l6 -6`} fill="none" stroke={SUCCESS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="142" y={outY + 25} fill={ACCENT} fontSize="11" fontWeight="700" letterSpacing="0.5">PLAIN-ENGLISH CAUSE AND FIX</text>
      <text x="142" y={outY + 46} fill="#ffffff" fontSize="13.5">Out of gas. Raise the gas limit in your wallet and retry.</text>
      <text x="142" y={outY + 66} fill="var(--text-muted)" fontSize="12">Nothing else left your wallet. You paid $1.18 in gas.</text>
    </svg>
  )
}

const FIGURES: Record<string, () => JSX.Element> = {
  "decode-flow": DecodeFlow,
}

export function Figure({ kind, caption }: { kind: string; caption?: string }) {
  const Body = FIGURES[kind]
  if (!Body) return null
  return (
    <figure className="my-10">
      <div className="mx-auto max-w-[640px] overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/40 p-5 sm:p-6">
        <Body />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-xs text-[var(--text-muted)]">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
