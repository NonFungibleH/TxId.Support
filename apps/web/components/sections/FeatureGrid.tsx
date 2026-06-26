import {
  Wallet,
  Activity,
  BookOpen,
  TrendingUp,
  Palette,
  Code2,
  Globe2,
  BarChart3,
} from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const FEATURES = [
  {
    icon: Wallet,
    title: "Auto Wallet Detection",
    description:
      "Silently reads the connected wallet the moment the widget opens. Users get personalised answers without lifting a finger.",
  },
  {
    icon: Activity,
    title: "Transaction Diagnostics",
    description:
      "Any failed transaction explained in plain English — cause, consequence, and the exact step to fix it — before they open a ticket.",
  },
  {
    icon: BookOpen,
    title: "Docs Q&A",
    description:
      "Paste your docs URL. The widget indexes it and answers questions grounded in your own documentation — not hallucinated.",
  },
  {
    icon: TrendingUp,
    title: "Live Token Context",
    description:
      "Set your token address. Users see price, DEX link, and contract info inline — no leaving your site to look it up.",
  },
  {
    icon: Palette,
    title: "Fully White-Label",
    description:
      "Your colours, font, and logo. The widget is invisible as a third-party tool — it looks and feels like part of your product.",
  },
  {
    icon: Code2,
    title: "Simple Embed",
    description:
      "Add one script tag before your closing body tag. Works with any stack — React, Next.js, Vue, or plain HTML.",
  },
  {
    icon: Globe2,
    title: "Multi-Chain",
    description:
      "Ethereum, Sepolia, Base, BNB Chain, Polygon, Arbitrum, and Optimism — wallet detection and transaction data across all of them.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "See how many users you're helping — conversations over time, satisfaction ratings, and what they're asking about.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">{`// Features`}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Everything your protocol needs to stop firefighting support
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Built for Web3 from the ground up — not a generic chatbot bolted on.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature, i) => (
            <FadeIn key={feature.title} delay={(i % 4) * 0.06}>
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors group h-full">
                <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <feature.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                </div>
                <h3 className="font-display font-semibold text-white text-sm mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
