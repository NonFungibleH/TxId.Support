import { FadeIn } from "@/components/ui/FadeIn"

const MODES = [
  {
    emoji: "🏛️",
    title: "Protocol",
    audience: "DeFi protocols & dApps",
    features: [
      "AI-powered user support",
      "Transaction diagnostics",
      "Docs Q&A via RAG",
      "Multi-chain wallet detection",
    ],
    cta: "Get started",
    href: "https://app.txid.support/sign-up",
    highlight: true,
    comingSoon: false,
  },
  {
    emoji: "🪙",
    title: "Project",
    audience: "Token projects & DAOs",
    features: [
      "Live price & 24h chart",
      "Buy button → best DEX",
      "Community links",
      "Lightweight AI chat",
    ],
    cta: "Get started",
    href: "https://app.txid.support/sign-up",
    highlight: false,
    comingSoon: false,
  },
  {
    emoji: "👤",
    title: "Individual",
    audience: "Coming soon",
    features: [
      "Public wallet page",
      "Portfolio context",
      "Shareable URL",
      "Onchain identity",
    ],
    cta: "Join waitlist",
    href: "#",
    highlight: false,
    comingSoon: true,
  },
]

export function ThreeModes() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="font-mono text-sm text-accent mb-3">{"// Three modes"}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              One widget, built for your use case
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Select the mode that fits when you create your project. The widget, dashboard, and AI adapt automatically.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {MODES.map((mode, i) => (
            <FadeIn key={mode.title} delay={i * 0.1}>
              <div
                className={`relative flex flex-col rounded-2xl border p-6 h-full ${
                  mode.highlight
                    ? "border-accent bg-accent/5"
                    : mode.comingSoon
                    ? "border-[var(--border)] bg-[var(--bg-surface)] opacity-60"
                    : "border-[var(--border)] bg-[var(--bg-surface)]"
                }`}
              >
                {mode.comingSoon && (
                  <span className="absolute top-4 right-4 text-xs font-mono text-muted border border-[var(--border)] rounded-full px-2 py-0.5">
                    Soon
                  </span>
                )}
                <div className="text-3xl mb-3">{mode.emoji}</div>
                <h3 className="font-display text-xl font-bold text-white mb-1">{mode.title}</h3>
                <p className="text-sm text-muted mb-4">{mode.audience}</p>
                <ul className="flex-1 space-y-2 mb-6">
                  {mode.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="text-accent">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {!mode.comingSoon && (
                  <a
                    href={mode.href}
                    className={`block text-center rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                      mode.highlight
                        ? "bg-accent text-white hover:bg-accent/90"
                        : "bg-[var(--bg-elevated)] text-white border border-[var(--border)] hover:border-accent"
                    }`}
                  >
                    {mode.cta}
                  </a>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
