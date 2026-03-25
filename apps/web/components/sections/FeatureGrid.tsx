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
      "Silently reads the connected wallet — no prompts, no popups. Users are greeted by name before they ask a thing.",
  },
  {
    icon: Activity,
    title: "Transaction Diagnostics",
    description:
      "Paste any tx hash or let us find it automatically. Failed transactions are explained in plain English with a suggested fix.",
  },
  {
    icon: BookOpen,
    title: "Docs Q&A via RAG",
    description:
      "Paste your docs URL. The widget crawls, indexes, and answers questions grounded in your own documentation.",
  },
  {
    icon: TrendingUp,
    title: "Live Token Price",
    description:
      "Set your token contract address. Users see live price, 7-day chart, and a one-tap Buy button pointing to the best DEX.",
  },
  {
    icon: Palette,
    title: "Fully White-Label",
    description:
      "Your colours, your font, your logo. The widget looks native to your site — not a third-party plugin.",
  },
  {
    icon: Code2,
    title: "Three Embed Methods",
    description:
      "Script tag, inline div, or React npm package. All generate from your dashboard with one click to copy.",
  },
  {
    icon: Globe2,
    title: "Multi-Chain",
    description:
      "Ethereum, Base, BNB Chain, Polygon, Arbitrum, and Optimism — wallet history and transaction data across all of them.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "See total conversations, most-asked questions, wallet lookup counts, and satisfaction ratings in one place.",
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
              Everything a DeFi protocol needs
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Built specifically for Web3 — not a chatbot wrapper.
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
