// Inline SVG figures for blog articles. Each is self-contained, theme-consistent
// (site tokens for neutrals + the brand indigo for accent) and scales to its
// container. Add one by giving it a `kind` and a case in FIGURES. Text is kept
// apostrophe-free and short so it never overflows its box or trips lint.

const ACCENT = "#6366f1"
const DANGER = "#ef4444"
const SUCCESS = "#34d399"
const SURFACE = "var(--bg-surface)"
const BORDER = "var(--border)"
const MUTED = "var(--text-muted)"
const WHITE = "#ffffff"
const ACCENT_SOFT = "rgba(99,102,241,0.08)"
const ACCENT_CHIP = "rgba(99,102,241,0.14)"

/** Small down arrow whose tip is at (x, y). */
function ADown({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} l-5 -7 h10 z`} fill={BORDER} />
}
/** Small right arrow whose tip is at (x, y). */
function ARight({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} l-7 -5 v10 z`} fill={BORDER} />
}
function Svg({ h, label, children }: { h: number; label: string; children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 640 ${h}`} width="100%" role="img" aria-label={label} style={{ display: "block" }}>
      {children}
    </svg>
  )
}

/** The decoder fallback ladder: a failed transaction becomes a plain answer. */
function DecodeFlow() {
  const rungs = [
    { n: "1", label: "Out of gas?", sub: "gas used reaches the gas limit" },
    { n: "2", label: "Revert reason?", sub: "Error(string), replayed on-chain" },
    { n: "3", label: "Custom error or panic?", sub: "decoded with the contract ABI" },
    { n: "4", label: "Signature lookup", sub: "4byte.directory as a last resort" },
  ]
  const rowH = 56, gap = 12, rowStart = 96
  const chipCy = (i: number) => rowStart + i * (rowH + gap) + rowH / 2
  const ladderBottom = rowStart + (rungs.length - 1) * (rowH + gap) + rowH
  const outY = ladderBottom + 20
  return (
    <Svg h={480} label="A failed transaction is decoded step by step into a plain-English cause and fix.">
      <rect x="160" y="8" width="320" height="60" rx="12" fill={SURFACE} stroke={BORDER} />
      <circle cx="186" cy="32" r="5" fill={DANGER} />
      <text x="204" y="31" fill={WHITE} fontSize="15" fontWeight="600">Failed transaction</text>
      <text x="204" y="50" fill={MUTED} fontSize="12" fontFamily="ui-monospace, monospace">0x9f3c…a12b reverted</text>
      <line x1="320" y1="68" x2="320" y2="86" stroke={BORDER} strokeWidth="2" />
      <ADown x={320} y={92} />
      <line x1="148" y1={chipCy(0)} x2="148" y2={chipCy(rungs.length - 1)} stroke={BORDER} strokeWidth="2" />
      {rungs.map((r, i) => {
        const y = rowStart + i * (rowH + gap), cy = chipCy(i)
        return (
          <g key={r.n}>
            <rect x="120" y={y} width="400" height={rowH} rx="10" fill={SURFACE} stroke={BORDER} />
            <circle cx="148" cy={cy} r="13" fill={ACCENT_CHIP} stroke={ACCENT} strokeWidth="1.5" />
            <text x="148" y={cy + 4} fill={ACCENT} fontSize="12" fontWeight="700" textAnchor="middle">{r.n}</text>
            <text x="176" y={cy - 4} fill={WHITE} fontSize="14" fontWeight="600">{r.label}</text>
            <text x="176" y={cy + 14} fill={MUTED} fontSize="12">{r.sub}</text>
          </g>
        )
      })}
      <line x1="320" y1={ladderBottom} x2="320" y2={outY - 6} stroke={BORDER} strokeWidth="2" />
      <ADown x={320} y={outY} />
      <rect x="96" y={outY + 4} width="448" height="86" rx="12" fill={ACCENT_SOFT} stroke={ACCENT} strokeOpacity="0.5" />
      <circle cx="124" cy={outY + 30} r="9" fill="rgba(52,211,153,0.15)" />
      <path d={`M119.5 ${outY + 30} l3 3 l6 -6`} fill="none" stroke={SUCCESS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="142" y={outY + 25} fill={ACCENT} fontSize="11" fontWeight="700" letterSpacing="0.5">PLAIN-ENGLISH CAUSE AND FIX</text>
      <text x="142" y={outY + 46} fill={WHITE} fontSize="13.5">Out of gas. Raise the gas limit in your wallet and retry.</text>
      <text x="142" y={outY + 66} fill={MUTED} fontSize="12">Nothing else left your wallet. You paid $1.18 in gas.</text>
    </Svg>
  )
}

/** Three tiers of support, from keyword search up to agentic. */
function SupportTiers() {
  const rows = [
    { label: "Keyword search", sub: "matches words in your docs", tag: "docs only" },
    { label: "RAG chatbot", sub: "answers from your docs in natural language", tag: "docs" },
    { label: "Agentic support", sub: "reads the live chain, then answers", tag: "docs + live chain", hi: true },
  ]
  const rowH = 60, gap = 14, x = 158, w = 402, y0 = 18
  const yOf = (i: number) => y0 + i * (rowH + gap)
  return (
    <Svg h={246} label="Three tiers of support: keyword search, then a docs chatbot, then agentic support that reads the live chain.">
      <line x1="122" y1={yOf(2) + rowH} x2="122" y2={yOf(0) + 6} stroke={BORDER} strokeWidth="2" />
      <path d="M122 18 l-5 8 h10 z" fill={ACCENT} />
      <text transform="rotate(-90 96 130)" x="96" y="130" fill={MUTED} fontSize="11" fontWeight="700" letterSpacing="1" textAnchor="middle">MORE IT CAN SEE</text>
      {rows.map((r, i) => {
        const y = yOf(i)
        return (
          <g key={r.label}>
            <rect x={x} y={y} width={w} height={rowH} rx="11" fill={r.hi ? ACCENT_SOFT : SURFACE} stroke={r.hi ? ACCENT : BORDER} strokeOpacity={r.hi ? 0.6 : 1} />
            <text x={x + 20} y={y + 26} fill={WHITE} fontSize="14.5" fontWeight="600">{r.label}</text>
            <text x={x + 20} y={y + 45} fill={MUTED} fontSize="12">{r.sub}</text>
            <text x={x + w - 16} y={y + 36} fill={r.hi ? ACCENT : MUTED} fontSize="11" fontWeight="600" textAnchor="end">{r.tag}</text>
          </g>
        )
      })}
    </Svg>
  )
}

/** Same question, two paths: a chatbot that retrieves vs an agent that investigates. */
function ChatbotVsAgent() {
  const panel = (x: number, hi: boolean, title: string, steps: string[], answer: string[], verdict: string, ok: boolean) => (
    <g>
      <rect x={x} y="86" width="250" height="228" rx="12" fill={hi ? ACCENT_SOFT : SURFACE} stroke={hi ? ACCENT : BORDER} strokeOpacity={hi ? 0.6 : 1} />
      <text x={x + 18} y="112" fill={hi ? ACCENT : MUTED} fontSize="12" fontWeight="700" letterSpacing="0.5">{title.toUpperCase()}</text>
      {steps.map((s, i) => (
        <text key={i} x={x + 18} y={138 + i * 20} fill={MUTED} fontSize="12">{s}</text>
      ))}
      <rect x={x + 14} y={148 + steps.length * 20} width="222" height="96" rx="9" fill="var(--bg-surface)" stroke={BORDER} />
      {answer.map((a, i) => (
        <text key={i} x={x + 28} y={172 + steps.length * 20 + i * 18} fill={WHITE} fontSize="12.5">{a}</text>
      ))}
      <text x={x + 28} y={148 + steps.length * 20 + 78} fill={ok ? SUCCESS : DANGER} fontSize="11" fontWeight="600">{(ok ? "✓ " : "✕ ") + verdict}</text>
    </g>
  )
  return (
    <Svg h={330} label="One question answered two ways: a retrieval chatbot gives a generic reply, an agent reads the transaction and answers specifically.">
      <rect x="180" y="10" width="280" height="42" rx="21" fill={SURFACE} stroke={BORDER} />
      <text x="320" y="36" fill={WHITE} fontSize="14" fontWeight="600" textAnchor="middle">Why did my swap fail?</text>
      <line x1="250" y1="52" x2="165" y2="82" stroke={BORDER} strokeWidth="2" />
      <line x1="390" y1="52" x2="475" y2="82" stroke={BORDER} strokeWidth="2" />
      {panel(40, false, "Support chatbot", ["searches your docs"], ["Swaps can fail for many", "reasons: gas, slippage,", "allowance, contract errors."], "generic, not about you", false)}
      {panel(350, true, "Agentic support", ["reads your last transaction", "checks docs and contract"], ["Your swap ran out of gas.", "Raise the limit and retry."], "specific to your transaction", true)}
    </Svg>
  )
}

/** A gas-limit bar that fills to the ceiling and reverts. Not your ETH balance. */
function GasGauge() {
  return (
    <Svg h={210} label="A gas-limit bar fills as the transaction runs and reverts when it reaches the limit. The gas limit is not your ETH balance.">
      <text x="90" y="40" fill={WHITE} fontSize="14" fontWeight="600">Gas limit: the compute you authorised for this transaction</text>
      <rect x="90" y="60" width="460" height="30" rx="15" fill={SURFACE} stroke={BORDER} />
      <path d="M90 60 h410 a15 15 0 0 1 0 30 h-410 a15 15 0 0 1 0 -30 z" fill={ACCENT_CHIP} />
      <rect x="500" y="60" width="50" height="30" rx="0" fill="rgba(239,68,68,0.18)" />
      <line x1="550" y1="52" x2="550" y2="98" stroke={DANGER} strokeWidth="2" />
      <text x="548" y="46" fill={DANGER} fontSize="12" fontWeight="600" textAnchor="end">ran out here, reverted</text>
      <text x="90" y="112" fill={MUTED} fontSize="12">gas used</text>
      <text x="550" y="112" fill={MUTED} fontSize="12" textAnchor="end">gas limit</text>
      <rect x="90" y="134" width="215" height="52" rx="10" fill={SURFACE} stroke={BORDER} />
      <text x="106" y="156" fill={WHITE} fontSize="12.5" fontWeight="600">Set too low?</text>
      <text x="106" y="174" fill={MUTED} fontSize="12">raise the limit and retry</text>
      <rect x="320" y="134" width="230" height="52" rx="10" fill="rgba(239,68,68,0.06)" stroke={DANGER} strokeOpacity="0.4" />
      <text x="336" y="156" fill={WHITE} fontSize="12.5" fontWeight="600">Not your ETH balance</text>
      <text x="336" y="174" fill={MUTED} fontSize="12">you can have plenty and still run out</text>
    </Svg>
  )
}

/** The Discord scam vector vs support that lives inside your app. */
function ScamVsSafe() {
  return (
    <Svg h={276} label="A random direct message impersonating support versus an assistant that lives inside your app and never messages first.">
      <rect x="34" y="16" width="266" height="244" rx="12" fill="rgba(239,68,68,0.05)" stroke={DANGER} strokeOpacity="0.4" />
      <circle cx="58" cy="44" r="9" fill="rgba(239,68,68,0.2)" />
      <text x="76" y="48" fill={DANGER} fontSize="12" fontWeight="700" letterSpacing="0.5">RANDOM DIRECT MESSAGE</text>
      <text x="52" y="86" fill={WHITE} fontSize="13">Official support here. Your</text>
      <text x="52" y="106" fill={WHITE} fontSize="13">funds are at risk, connect</text>
      <text x="52" y="126" fill={WHITE} fontSize="13">your wallet to fix it.</text>
      <rect x="52" y="146" width="220" height="34" rx="8" fill={SURFACE} stroke={DANGER} strokeOpacity="0.5" />
      <text x="66" y="168" fill={DANGER} fontSize="12" fontFamily="ui-monospace, monospace">app-support-fix.xyz</text>
      <text x="52" y="212" fill={DANGER} fontSize="12.5" fontWeight="600">✕ drains the wallet on approve</text>
      <text x="52" y="236" fill={MUTED} fontSize="12">nobody sees it happen</text>

      <rect x="340" y="16" width="266" height="244" rx="12" fill={ACCENT_SOFT} stroke={ACCENT} strokeOpacity="0.5" />
      <circle cx="364" cy="44" r="9" fill={ACCENT_CHIP} />
      <text x="382" y="48" fill={ACCENT} fontSize="12" fontWeight="700" letterSpacing="0.5">IN-APP ASSISTANT</text>
      <text x="358" y="90" fill={WHITE} fontSize="13">Appears inside your app</text>
      <text x="358" y="120" fill={WHITE} fontSize="13">Never messages first</text>
      <text x="358" y="150" fill={WHITE} fontSize="13">Never asks for keys or seed</text>
      <text x="358" y="212" fill={SUCCESS} fontSize="12.5" fontWeight="600">✓ reads the chain to help</text>
      <text x="358" y="236" fill={MUTED} fontSize="12">one place users can trust</text>
    </Svg>
  )
}

/** A deflection funnel: most questions are handled before a human is needed. */
function DeflectionFunnel() {
  const stages = [
    { w: 400, label: "100 support questions", sub: "" },
    { w: 320, label: "Docs Q&A handles the FAQs", sub: "" },
    { w: 240, label: "On-chain diagnosis explains failures", sub: "" },
    { w: 168, label: "Self-serve fixes, no human", sub: "" },
  ]
  const h = 44, gap = 20, y0 = 16
  const yOf = (i: number) => y0 + i * (h + gap)
  return (
    <Svg h={330} label="A funnel where docs answers, on-chain diagnosis and self-serve fixes deflect most questions, so only about forty in a hundred reach a human.">
      {stages.map((s, i) => {
        const x = 40 + (400 - s.w) / 2, y = yOf(i)
        return (
          <g key={i}>
            <rect x={x} y={y} width={s.w} height={h} rx="9" fill={i === 0 ? SURFACE : ACCENT_SOFT} stroke={i === 0 ? BORDER : ACCENT} strokeOpacity={i === 0 ? 1 : 0.4} />
            <text x={240} y={y + 27} fill={WHITE} fontSize="12.5" fontWeight={i === 0 ? "600" : "400"} textAnchor="middle">{s.label}</text>
            {i < stages.length && <ADown x={240} y={y + h + gap - 6} />}
          </g>
        )
      })}
      <rect x="176" y={yOf(4)} width="128" height="46" rx="9" fill={ACCENT_SOFT} stroke={ACCENT} strokeOpacity="0.6" />
      <text x="240" y={yOf(4) + 28} fill={WHITE} fontSize="12.5" fontWeight="600" textAnchor="middle">~40 reach a human</text>
      <text x="470" y="150" fill={ACCENT} fontSize="52" fontWeight="800">60%</text>
      <text x="470" y="178" fill={MUTED} fontSize="14">fewer tickets</text>
    </Svg>
  )
}

/** How docs become searchable answers: crawl, chunk, embed, retrieve, cite. */
function RagPipeline() {
  const box = (x: number, w: number, y: number, label: string, accent?: boolean) => (
    <g>
      <rect x={x} y={y} width={w} height="46" rx="9" fill={accent ? ACCENT_SOFT : SURFACE} stroke={accent ? ACCENT : BORDER} strokeOpacity={accent ? 0.6 : 1} />
      <text x={x + w / 2} y={y + 28} fill={WHITE} fontSize="12.5" fontWeight="600" textAnchor="middle">{label}</text>
    </g>
  )
  return (
    <Svg h={240} label="Your documentation is crawled, chunked and embedded into a vector store, then a user question retrieves the right passages and the answer cites them.">
      <text x="20" y="24" fill={MUTED} fontSize="11" fontWeight="700" letterSpacing="0.5">ONCE, ON INGEST</text>
      {box(20, 96, 36, "Your docs")}
      <ARight x={128} y={59} /><line x1="116" y1="59" x2="126" y2="59" stroke={BORDER} strokeWidth="2" />
      {box(132, 84, 36, "Crawl")}
      <ARight x={228} y={59} /><line x1="216" y1="59" x2="226" y2="59" stroke={BORDER} strokeWidth="2" />
      {box(232, 84, 36, "Chunk")}
      <ARight x={328} y={59} /><line x1="316" y1="59" x2="326" y2="59" stroke={BORDER} strokeWidth="2" />
      {box(332, 84, 36, "Embed")}
      <ARight x={432} y={59} /><line x1="416" y1="59" x2="430" y2="59" stroke={BORDER} strokeWidth="2" />
      {box(436, 150, 36, "Vector store", true)}

      <line x1="511" y1="82" x2="511" y2="150" stroke={BORDER} strokeWidth="2" strokeDasharray="4 4" />
      <ADown x={511} y={156} />

      <text x="20" y="150" fill={MUTED} fontSize="11" fontWeight="700" letterSpacing="0.5">PER QUESTION</text>
      {box(20, 150, 162, "User question")}
      <ARight x={362} y={185} /><line x1="176" y1="185" x2="360" y2="185" stroke={BORDER} strokeWidth="2" />
      {box(366, 220, 162, "Answer with a citation", true)}
    </Svg>
  )
}

/** The same question, a generic answer vs a wallet-aware one. */
function WalletAware() {
  return (
    <Svg h={272} label="The same question gets a generic answer from a normal chatbot and a specific one from wallet-aware support that read the transaction.">
      <rect x="300" y="14" width="300" height="44" rx="14" fill={ACCENT} />
      <text x="450" y="41" fill={WHITE} fontSize="13.5" fontWeight="600" textAnchor="middle">Why did my transaction fail?</text>

      <rect x="40" y="80" width="420" height="66" rx="14" fill={SURFACE} stroke={BORDER} />
      <text x="58" y="104" fill={MUTED} fontSize="11" fontWeight="700" letterSpacing="0.5">GENERIC CHATBOT</text>
      <text x="58" y="128" fill={WHITE} fontSize="13">It could be gas, slippage, allowance, or a contract error.</text>

      <rect x="40" y="166" width="470" height="84" rx="14" fill={ACCENT_SOFT} stroke={ACCENT} strokeOpacity="0.55" />
      <text x="58" y="190" fill={ACCENT} fontSize="11" fontWeight="700" letterSpacing="0.5">WALLET-AWARE SUPPORT</text>
      <text x="58" y="214" fill={WHITE} fontSize="13">Your swap ran out of gas at the limit you set. Raise it and</text>
      <text x="58" y="232" fill={WHITE} fontSize="13">retry. Nothing else left your wallet.</text>
      <text x="480" y="190" fill={SUCCESS} fontSize="11" fontWeight="600" textAnchor="end">read your tx</text>
    </Svg>
  )
}

/** Four on-chain data sources, each mapped to the question it answers. */
function FourSources() {
  const rows = [
    { src: "Transaction history", sub: "reverts and gas", q: "Why did my transaction fail?" },
    { src: "Token balances and approvals", sub: "ERC-20 allowances", q: "Is my approval set? Enough balance?" },
    { src: "Connected chain", sub: "network detection", q: "Am I on the wrong network?" },
    { src: "Contract state", sub: "locks, vesting, rewards", q: "Is my lock unlocked yet?" },
  ]
  const h = 56, gap = 12, y0 = 14
  const yOf = (i: number) => y0 + i * (h + gap)
  return (
    <Svg h={286} label="Four on-chain data sources and the support question each one answers.">
      {rows.map((r, i) => {
        const y = yOf(i)
        return (
          <g key={r.src}>
            <rect x="24" y={y} width="270" height={h} rx="10" fill={SURFACE} stroke={BORDER} />
            <text x="42" y={y + 24} fill={WHITE} fontSize="13" fontWeight="600">{r.src}</text>
            <text x="42" y={y + 42} fill={MUTED} fontSize="11.5">{r.sub}</text>
            <line x1="300" y1={y + h / 2} x2="330" y2={y + h / 2} stroke={BORDER} strokeWidth="2" />
            <ARight x={332} y={y + h / 2} />
            <rect x="340" y={y} width="276" height={h} rx="10" fill={ACCENT_SOFT} stroke={ACCENT} strokeOpacity="0.4" />
            <text x="358" y={y + h / 2 + 5} fill={WHITE} fontSize="13">{r.q}</text>
          </g>
        )
      })}
    </Svg>
  )
}

/** On-chain support answering in the open inside a Telegram group. */
function TelegramFlow() {
  return (
    <Svg h={250} label="In a Telegram group a member asks the bot why a swap failed and the bot answers in the open with a diagnosis from the chain.">
      <rect x="40" y="12" width="560" height="34" rx="9" fill={SURFACE} stroke={BORDER} />
      <circle cx="62" cy="29" r="8" fill={ACCENT_CHIP} />
      <text x="80" y="34" fill={WHITE} fontSize="12.5" fontWeight="600">Protocol community</text>
      <text x="584" y="34" fill={MUTED} fontSize="12" textAnchor="end">4,210 members</text>

      <circle cx="62" cy="82" r="12" fill={SURFACE} stroke={BORDER} />
      <rect x="84" y="66" width="360" height="40" rx="12" fill={SURFACE} stroke={BORDER} />
      <text x="102" y="91" fill={WHITE} fontSize="13"><tspan fill={ACCENT}>@SupportBot</tspan> why did my swap fail?</text>

      <circle cx="62" cy="150" r="12" fill={ACCENT_CHIP} stroke={ACCENT} />
      <rect x="84" y="126" width="470" height="60" rx="12" fill={ACCENT_SOFT} stroke={ACCENT} strokeOpacity="0.5" />
      <text x="102" y="150" fill={WHITE} fontSize="13">Your swap ran out of gas. Raise the limit and retry.</text>
      <text x="102" y="170" fill={MUTED} fontSize="11.5">read your last transaction on-chain</text>

      <text x="84" y="220" fill={MUTED} fontSize="12">The bot answers in the open. It never messages members first.</text>
    </Svg>
  )
}

const FIGURES: Record<string, () => JSX.Element> = {
  "decode-flow": DecodeFlow,
  "support-tiers": SupportTiers,
  "chatbot-vs-agent": ChatbotVsAgent,
  "gas-gauge": GasGauge,
  "scam-vs-safe": ScamVsSafe,
  "deflection-funnel": DeflectionFunnel,
  "rag-pipeline": RagPipeline,
  "wallet-aware": WalletAware,
  "four-sources": FourSources,
  "telegram-flow": TelegramFlow,
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
