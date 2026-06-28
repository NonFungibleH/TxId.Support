"use client"

export function PostHeroImage({ variant, className }: { variant: string; className?: string }) {
  return (
    <div className={className}>
      {variant === "discord-scam" && <DiscordScamSVG />}
      {variant === "ticket-reduction" && <TicketReductionSVG />}
      {variant === "docs-qa" && <DocsQaSVG />}
      {variant === "wallet-vs-generic" && <WalletVsGenericSVG />}
      {variant === "on-chain-data" && <OnChainDataSVG />}
    </div>
  )
}

function DiscordScamSVG() {
  return (
    <svg viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <defs>
        <style>{`
          @keyframes ds_fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes ds_slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes ds_popIn {
            from { opacity: 0; transform: scale(0.7); }
            to { opacity: 1; transform: scale(1); }
          }
          .ds_msg { animation: ds_fadeIn 0.4s ease forwards; animation-delay: 0.4s; opacity: 0; }
          .ds_scam { animation: ds_slideUp 0.5s ease forwards; animation-delay: 1.2s; opacity: 0; }
          .ds_shield { animation: ds_popIn 0.4s ease forwards; animation-delay: 2s; opacity: 0; transform-origin: 520px 112px; }
        `}</style>
      </defs>

      {/* Background */}
      <rect width="700" height="280" fill="#07070d" />

      {/* LEFT panel — Discord-style */}
      <rect x="20" y="15" width="310" height="250" rx="10" fill="#0f0f1a" stroke="#1e1e3a" strokeWidth="1.5" />

      {/* Header bar */}
      <rect x="20" y="15" width="310" height="36" rx="10" fill="#0c0c18" />
      <rect x="20" y="37" width="310" height="14" fill="#0c0c18" />
      <text x="38" y="38" fontFamily="monospace" fontSize="11" fill="#64748b"># support</text>

      {/* User message bubble */}
      <g className="ds_msg">
        <circle cx="52" cy="80" r="13" fill="#6366f1" />
        <text x="46" y="84" fontFamily="monospace" fontSize="10" fill="white" fontWeight="bold">C</text>
        <text x="72" y="76" fontFamily="monospace" fontSize="9" fill="#94a3b8" fontWeight="bold">CryptoUser_4291</text>
        <rect x="72" y="82" width="220" height="28" rx="6" fill="#141428" />
        <text x="82" y="98" fontFamily="monospace" fontSize="9" fill="#94a3b8">my tx failed... funds stuck!</text>
      </g>

      {/* Scam DM popup */}
      <g className="ds_scam">
        <rect x="30" y="128" width="290" height="120" rx="8" fill="#1c0f0f" stroke="#ef4444" strokeWidth="1.5" />
        <text x="42" y="148" fontFamily="monospace" fontSize="8" fill="#ef4444" fontWeight="bold">⚠ Direct Message — FakeAdmin_Support</text>
        <line x1="30" y1="155" x2="320" y2="155" stroke="#ef4444" strokeWidth="0.5" strokeOpacity="0.4" />
        <circle cx="47" cy="172" r="10" fill="#7f1d1d" />
        <text x="42" y="176" fontFamily="monospace" fontSize="9" fill="#fca5a5" fontWeight="bold">F</text>
        <text x="63" y="168" fontFamily="monospace" fontSize="8" fill="#fca5a5" fontWeight="bold">FakeAdmin_Support</text>
        <text x="63" y="180" fontFamily="monospace" fontSize="8" fill="#94a3b8">I can help! Visit our recovery portal:</text>
        <text x="63" y="192" fontFamily="monospace" fontSize="8" fill="#f87171">wallet-recovery[.]support/fix</text>
        <rect x="42" y="205" width="120" height="22" rx="5" fill="#dc2626" />
        <text x="68" y="220" fontFamily="monospace" fontSize="9" fill="white" fontWeight="bold">CLAIM REFUND</text>
      </g>

      {/* Divider */}
      <line x1="350" y1="25" x2="350" y2="255" stroke="#1e1e3a" strokeWidth="1" strokeDasharray="4 4" />
      <text x="340" y="145" fontFamily="monospace" fontSize="11" fill="#64748b">vs</text>

      {/* RIGHT panel — In-app support */}
      <rect x="365" y="15" width="315" height="250" rx="10" fill="#0a1a0a" stroke="#10b981" strokeWidth="1.5" />
      <rect x="365" y="15" width="315" height="36" rx="10" fill="#071209" />
      <rect x="365" y="37" width="315" height="14" fill="#071209" />
      <text x="383" y="38" fontFamily="monospace" fontSize="11" fill="#10b981">In-app support</text>

      {/* Shield icon */}
      <g className="ds_shield">
        <path d="M520 60 L565 75 L565 115 Q565 150 520 165 Q475 150 475 115 L475 75 Z" fill="#10b98120" stroke="#10b981" strokeWidth="2" />
        <polyline points="503,112 516,126 538,98" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Bullet points */}
      <text x="390" y="192" fontFamily="monospace" fontSize="9" fill="#10b981">✓</text>
      <text x="404" y="192" fontFamily="monospace" fontSize="9" fill="#64748b">No DM attack surface</text>
      <text x="390" y="208" fontFamily="monospace" fontSize="9" fill="#10b981">✓</text>
      <text x="404" y="208" fontFamily="monospace" fontSize="9" fill="#64748b">Embedded in your app UI</text>
      <text x="390" y="224" fontFamily="monospace" fontSize="9" fill="#10b981">✓</text>
      <text x="404" y="224" fontFamily="monospace" fontSize="9" fill="#64748b">No scammer insert point</text>
      <text x="390" y="240" fontFamily="monospace" fontSize="9" fill="#10b981">✓</text>
      <text x="404" y="240" fontFamily="monospace" fontSize="9" fill="#64748b">Wallet context available</text>
    </svg>
  )
}

function TicketReductionSVG() {
  return (
    <svg viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <defs>
        <style>{`
          @keyframes tr_grow1 { from { height: 0; y: 240; } to { height: 160; y: 80; } }
          @keyframes tr_grow2 { from { height: 0; y: 240; } to { height: 125; y: 115; } }
          @keyframes tr_grow3 { from { height: 0; y: 240; } to { height: 95; y: 145; } }
          @keyframes tr_grow4 { from { height: 0; y: 240; } to { height: 72; y: 168; } }
          @keyframes tr_grow5 { from { height: 0; y: 240; } to { height: 62; y: 178; } }
          @keyframes tr_fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .tr_bar1 { animation: tr_grow1 0.5s ease forwards; animation-delay: 0.3s; height: 0; y: 240; }
          .tr_bar2 { animation: tr_grow2 0.5s ease forwards; animation-delay: 0.5s; height: 0; y: 240; }
          .tr_bar3 { animation: tr_grow3 0.5s ease forwards; animation-delay: 0.7s; height: 0; y: 240; }
          .tr_bar4 { animation: tr_grow4 0.5s ease forwards; animation-delay: 0.9s; height: 0; y: 240; }
          .tr_bar5 { animation: tr_grow5 0.5s ease forwards; animation-delay: 1.1s; height: 0; y: 240; }
          .tr_label { animation: tr_fadeIn 0.4s ease forwards; animation-delay: 1.4s; opacity: 0; }
        `}</style>
        <linearGradient id="tr_barGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      <rect width="700" height="280" fill="#07070d" />

      {/* Title */}
      <text x="40" y="44" fontFamily="monospace" fontSize="14" fill="white" fontWeight="bold">Support Ticket Volume</text>
      <text x="40" y="60" fontFamily="monospace" fontSize="10" fill="#64748b">Before → After implementing this playbook</text>

      {/* Y-axis line */}
      <line x1="70" y1="72" x2="70" y2="248" stroke="#1e1e3a" strokeWidth="1" />
      {/* X-axis line */}
      <line x1="70" y1="248" x2="560" y2="248" stroke="#1e1e3a" strokeWidth="1" />

      {/* Bars */}
      <rect className="tr_bar1" x="80" width="70" fill="url(#tr_barGrad)" rx="3" />
      <rect className="tr_bar2" x="175" width="70" fill="url(#tr_barGrad)" rx="3" />
      <rect className="tr_bar3" x="270" width="70" fill="url(#tr_barGrad)" rx="3" />
      <rect className="tr_bar4" x="365" width="70" fill="url(#tr_barGrad)" rx="3" />
      <rect className="tr_bar5" x="460" width="70" fill="url(#tr_barGrad)" rx="3" />

      {/* Volume labels above bars */}
      <text x="100" y="74" fontFamily="monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">100%</text>
      <text x="195" y="109" fontFamily="monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">78%</text>
      <text x="290" y="139" fontFamily="monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">59%</text>
      <text x="385" y="162" fontFamily="monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">45%</text>
      <text x="480" y="172" fontFamily="monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">39%</text>

      {/* X-axis labels */}
      <text x="115" y="262" fontFamily="monospace" fontSize="10" fill="#64748b" textAnchor="middle">Week 1</text>
      <text x="210" y="262" fontFamily="monospace" fontSize="10" fill="#64748b" textAnchor="middle">Week 2</text>
      <text x="305" y="262" fontFamily="monospace" fontSize="10" fill="#64748b" textAnchor="middle">Week 3</text>
      <text x="400" y="262" fontFamily="monospace" fontSize="10" fill="#64748b" textAnchor="middle">Week 4</text>
      <text x="495" y="262" fontFamily="monospace" fontSize="10" fill="#64748b" textAnchor="middle">Week 5</text>

      {/* Big stat on right */}
      <g className="tr_label">
        <text x="610" y="160" fontFamily="monospace" fontSize="52" fill="#10b981" fontWeight="bold" textAnchor="middle">60%</text>
        <text x="610" y="182" fontFamily="monospace" fontSize="12" fill="#64748b" textAnchor="middle">reduction</text>
      </g>
    </svg>
  )
}

function DocsQaSVG() {
  return (
    <svg viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <defs>
        <style>{`
          @keyframes dq_fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes dq_pulse { 0%, 100% { opacity: 0.6; r: 8; } 50% { opacity: 1; r: 11; } }
          @keyframes dq_travel {
            0% { offset-distance: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { offset-distance: 100%; opacity: 0; }
          }
          .dq_left { animation: dq_fadeIn 0.5s ease forwards; animation-delay: 0.3s; opacity: 0; }
          .dq_right { animation: dq_fadeIn 0.5s ease forwards; animation-delay: 1.8s; opacity: 0; }
          .dq_node1 { animation: dq_pulse 2s ease-in-out infinite; animation-delay: 0.8s; }
          .dq_node2 { animation: dq_pulse 2s ease-in-out infinite; animation-delay: 1.1s; }
          .dq_node3 { animation: dq_pulse 2s ease-in-out infinite; animation-delay: 1.4s; }
        `}</style>
      </defs>

      <rect width="700" height="280" fill="#07070d" />

      {/* LEFT — Your docs */}
      <g className="dq_left">
        <text x="30" y="38" fontFamily="monospace" fontSize="11" fill="#6366f1" fontWeight="bold">Your docs</text>
        {/* URL bar */}
        <rect x="20" y="48" width="190" height="22" rx="5" fill="#141428" />
        <text x="32" y="63" fontFamily="monospace" fontSize="9" fill="#64748b">docs.protocol.xyz</text>
        {/* Paragraph lines */}
        <rect x="20" y="80" width="170" height="7" rx="2" fill="#1e1e3a" />
        <rect x="20" y="94" width="145" height="7" rx="2" fill="#1e1e3a" />
        {/* Highlighted chunk */}
        <rect x="20" y="108" width="160" height="7" rx="2" fill="#6366f1" fillOpacity="0.5" stroke="#6366f1" strokeWidth="0.5" strokeDasharray="3 2" />
        <rect x="20" y="122" width="130" height="7" rx="2" fill="#1e1e3a" />
        <rect x="20" y="136" width="155" height="7" rx="2" fill="#1e1e3a" />
      </g>

      {/* MIDDLE — AI retrieval */}
      <text x="258" y="38" fontFamily="monospace" fontSize="11" fill="#64748b">AI retrieval</text>

      {/* Vector nodes */}
      <line x1="330" y1="100" x2="310" y2="140" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="330" y1="100" x2="355" y2="140" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="310" y1="140" x2="355" y2="140" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.4" />
      <circle className="dq_node1" cx="330" cy="100" r="8" fill="#6366f1" />
      <circle className="dq_node2" cx="310" cy="140" r="8" fill="#6366f1" />
      <circle className="dq_node3" cx="355" cy="140" r="8" fill="#6366f1" />

      <text x="333" y="175" fontFamily="monospace" fontSize="9" fill="#64748b" textAnchor="middle">RAG pipeline</text>

      {/* Arrow */}
      <text x="400" y="125" fontFamily="monospace" fontSize="20" fill="#6366f1" textAnchor="middle">→</text>

      {/* RIGHT — Answer */}
      <g className="dq_right">
        <text x="430" y="38" fontFamily="monospace" fontSize="11" fill="#10b981" fontWeight="bold">Answer</text>
        <rect x="420" y="48" width="260" height="175" rx="8" fill="#0d1f0d" stroke="#10b981" strokeWidth="1.5" />
        <text x="432" y="68" fontFamily="monospace" fontSize="10" fill="#64748b">User: why did my tx fail?</text>
        <line x1="420" y1="76" x2="680" y2="76" stroke="#10b981" strokeWidth="0.5" strokeOpacity="0.3" />
        <text x="432" y="94" fontFamily="monospace" fontSize="9" fill="#94a3b8">Agent: Your swap of 500 USDC</text>
        <text x="432" y="108" fontFamily="monospace" fontSize="9" fill="#94a3b8">for ETH failed due to</text>
        <text x="432" y="122" fontFamily="monospace" fontSize="9" fill="#10b981">INSUFFICIENT_OUTPUT_AMOUNT.</text>
        <text x="432" y="136" fontFamily="monospace" fontSize="9" fill="#94a3b8">Try increasing slippage to</text>
        <text x="432" y="150" fontFamily="monospace" fontSize="9" fill="#94a3b8">1% and retry.</text>
      </g>
    </svg>
  )
}

function WalletVsGenericSVG() {
  return (
    <svg viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <defs>
        <style>{`
          @keyframes wv_dot1 { 0%, 100% { opacity: 0.2; } 33% { opacity: 1; } }
          @keyframes wv_dot2 { 0%, 100% { opacity: 0.2; } 66% { opacity: 1; } }
          @keyframes wv_dot3 { 0%, 100% { opacity: 0.2; } 100% { opacity: 1; } }
          .wv_dot1 { animation: wv_dot1 1.2s ease-in-out infinite; }
          .wv_dot2 { animation: wv_dot2 1.2s ease-in-out infinite; }
          .wv_dot3 { animation: wv_dot3 1.2s ease-in-out infinite; }
        `}</style>
      </defs>

      <rect width="700" height="280" fill="#07070d" />

      {/* LEFT half */}
      <rect x="0" y="0" width="350" height="280" fill="#0f0f1a" />

      {/* LEFT header */}
      <text x="175" y="34" fontFamily="monospace" fontSize="12" fill="#64748b" textAnchor="middle" fontWeight="bold">Generic Chatbot</text>
      <line x1="0" y1="44" x2="350" y2="44" stroke="#1e1e3a" strokeWidth="1" />

      {/* Chat bubbles - LEFT */}
      {/* User bubble */}
      <rect x="200" y="58" width="130" height="24" rx="8" fill="#1e1e3a" />
      <text x="265" y="74" fontFamily="monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">my swap failed</text>

      {/* Bot bubble 1 with typing dots */}
      <rect x="20" y="92" width="190" height="24" rx="8" fill="#141428" />
      <text x="30" y="108" fontFamily="monospace" fontSize="9" fill="#64748b">What error did you see?</text>

      {/* Typing indicator */}
      <rect x="20" y="126" width="60" height="20" rx="8" fill="#141428" />
      <circle className="wv_dot1" cx="35" cy="136" r="3" fill="#64748b" />
      <circle className="wv_dot2" cx="47" cy="136" r="3" fill="#64748b" />
      <circle className="wv_dot3" cx="59" cy="136" r="3" fill="#64748b" />

      {/* Bot bubble 2 */}
      <rect x="20" y="156" width="175" height="24" rx="8" fill="#141428" />
      <text x="30" y="172" fontFamily="monospace" fontSize="9" fill="#64748b">Which network are you on?</text>

      {/* Bot bubble 3 */}
      <rect x="20" y="190" width="165" height="24" rx="8" fill="#141428" />
      <text x="30" y="206" fontFamily="monospace" fontSize="9" fill="#64748b">Can you share your wallet?</text>

      {/* Bottom label */}
      <text x="175" y="248" fontFamily="monospace" fontSize="9" fill="#ef4444" textAnchor="middle" fillOpacity="0.7">User opens Discord instead</text>

      {/* Divider */}
      <line x1="350" y1="0" x2="350" y2="280" stroke="#1e1e3a" strokeWidth="1.5" />

      {/* RIGHT half */}
      <rect x="350" y="0" width="350" height="280" fill="#0a0f1a" />

      {/* RIGHT header */}
      <text x="525" y="34" fontFamily="monospace" fontSize="12" fill="#10b981" textAnchor="middle" fontWeight="bold">Wallet-Aware Support</text>
      <line x1="350" y1="44" x2="700" y2="44" stroke="#1e1e3a" strokeWidth="1" />

      {/* Wallet info bar */}
      <rect x="360" y="52" width="330" height="26" rx="6" fill="#141428" stroke="#6366f1" strokeWidth="1" />
      <circle cx="376" cy="65" r="6" fill="#6366f1" />
      <text x="388" y="70" fontFamily="monospace" fontSize="9" fill="#6366f1">0x742...d3f1 · Ethereum</text>

      {/* User bubble */}
      <rect x="520" y="90" width="130" height="24" rx="8" fill="#1e293b" />
      <text x="585" y="106" fontFamily="monospace" fontSize="9" fill="#94a3b8" textAnchor="middle">my swap failed</text>

      {/* Bot answer */}
      <rect x="360" y="124" width="315" height="80" rx="8" fill="#0d1a0d" stroke="#10b981" strokeWidth="1" />
      <text x="372" y="142" fontFamily="monospace" fontSize="8.5" fill="#94a3b8">Your swap of 500 USDC → ETH</text>
      <text x="372" y="156" fontFamily="monospace" fontSize="8.5" fill="#94a3b8">failed 3 min ago. Revert:</text>
      <text x="372" y="170" fontFamily="monospace" fontSize="8.5" fill="#10b981">INSUFFICIENT_OUTPUT_AMOUNT.</text>
      <text x="372" y="184" fontFamily="monospace" fontSize="8.5" fill="#94a3b8">Try 1% slippage.</text>

      {/* Resolution label */}
      <text x="525" y="248" fontFamily="monospace" fontSize="10" fill="#10b981" textAnchor="middle">✓ Resolved in 12 seconds</text>
    </svg>
  )
}

function OnChainDataSVG() {
  return (
    <svg viewBox="0 0 700 280" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <defs>
        <style>{`
          @keyframes oc_pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.15); }
          }
          @keyframes oc_dash {
            from { stroke-dashoffset: 20; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes oc_arrowPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          .oc_ring1 { animation: oc_pulse 2s ease-in-out infinite; transform-origin: 555px 148px; }
          .oc_ring2 { animation: oc_pulse 2s ease-in-out infinite; animation-delay: 0.5s; transform-origin: 555px 148px; }
          .oc_line { animation: oc_dash 1s linear infinite; stroke-dasharray: 4 4; }
          .oc_arrow { animation: oc_arrowPulse 1.5s ease-in-out infinite; }
        `}</style>
      </defs>

      <rect width="700" height="280" fill="#07070d" />

      {/* Title */}
      <text x="20" y="36" fontFamily="monospace" fontSize="13" fill="white" fontWeight="bold">What your support bot reads</text>

      {/* Card 1 — Tx History */}
      <rect x="20" y="56" width="155" height="95" rx="8" fill="#0f0f1a" stroke="#6366f1" strokeWidth="1.5" />
      <text x="32" y="80" fontFamily="monospace" fontSize="11" fill="white" fontWeight="bold">Tx History</text>
      <text x="32" y="96" fontFamily="monospace" fontSize="9" fill="#64748b">Reverts, hashes,</text>
      <text x="32" y="110" fontFamily="monospace" fontSize="9" fill="#64748b">status</text>

      {/* Card 2 — Token Balances */}
      <rect x="185" y="56" width="155" height="95" rx="8" fill="#0f0f1a" stroke="#8b5cf6" strokeWidth="1.5" />
      <text x="197" y="80" fontFamily="monospace" fontSize="11" fill="white" fontWeight="bold">Token Balances</text>
      <text x="197" y="96" fontFamily="monospace" fontSize="9" fill="#64748b">ERC-20,</text>
      <text x="197" y="110" fontFamily="monospace" fontSize="9" fill="#64748b">approvals</text>

      {/* Card 3 — Chain ID */}
      <rect x="20" y="163" width="155" height="95" rx="8" fill="#0f0f1a" stroke="#06b6d4" strokeWidth="1.5" />
      <text x="32" y="187" fontFamily="monospace" fontSize="11" fill="white" fontWeight="bold">Chain ID</text>
      <text x="32" y="203" fontFamily="monospace" fontSize="9" fill="#64748b">Network</text>
      <text x="32" y="217" fontFamily="monospace" fontSize="9" fill="#64748b">detection</text>

      {/* Card 4 — Contract State */}
      <rect x="185" y="163" width="155" height="95" rx="8" fill="#0f0f1a" stroke="#f59e0b" strokeWidth="1.5" />
      <text x="197" y="187" fontFamily="monospace" fontSize="11" fill="white" fontWeight="bold">Contract State</text>
      <text x="197" y="203" fontFamily="monospace" fontSize="9" fill="#64748b">Locks, vesting,</text>
      <text x="197" y="217" fontFamily="monospace" fontSize="9" fill="#64748b">rewards</text>

      {/* Connecting lines from cards to center point */}
      <line className="oc_line" x1="175" y1="103" x2="390" y2="148" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.5" />
      <line className="oc_line" x1="340" y1="103" x2="390" y2="148" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.5" />
      <line className="oc_line" x1="175" y1="210" x2="390" y2="148" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.5" />
      <line className="oc_line" x1="340" y1="210" x2="390" y2="148" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.5" />

      {/* Arrow */}
      <g className="oc_arrow">
        <text x="370" y="154" fontFamily="monospace" fontSize="22" fill="#6366f1" textAnchor="middle">→</text>
      </g>

      {/* AI Agent box */}
      <rect x="405" y="78" width="275" height="140" rx="10" fill="#141428" stroke="#6366f1" strokeWidth="2" />
      <text x="542" y="110" fontFamily="monospace" fontSize="14" fill="#6366f1" textAnchor="middle" fontWeight="bold">AI Agent</text>
      <text x="542" y="132" fontFamily="monospace" fontSize="10" fill="#94a3b8" textAnchor="middle">Knows exactly what happened</text>

      {/* Pulsing rings */}
      <circle className="oc_ring2" cx="555" cy="170" r="22" fill="none" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.3" />
      <circle className="oc_ring1" cx="555" cy="170" r="14" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.5" />
      <circle cx="555" cy="170" r="6" fill="#6366f1" />
    </svg>
  )
}
