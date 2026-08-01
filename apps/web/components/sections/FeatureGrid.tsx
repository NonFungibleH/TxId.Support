import {
  Wallet,
  Activity,
  BookOpen,
  TrendingUp,
  Palette,
  Code2,
  Globe2,
  BarChart3,
  Zap,
  Sparkles,
  Plug,
  Send,
} from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const FEATURES = [
  {
    icon: Wallet,
    title: "Auto wallet detection",
    description:
      "Reads the connected wallet the moment support opens. Personalized answers, zero effort from the user.",
  },
  {
    icon: Activity,
    title: "Transaction diagnostics",
    description:
      "Failed transactions explained with the cause and the fix, before anyone opens a ticket.",
  },
  {
    icon: Zap,
    title: "Actions (optional)",
    description:
      "Users ask for a swap, stake or claim; TxID prepares it and they sign in their own wallet. Paid plans, off by default.",
  },
  {
    icon: BookOpen,
    title: "Docs Q&A",
    description:
      "Point it at your docs. Answers come from your documentation, nowhere else.",
  },
  {
    icon: TrendingUp,
    title: "Live token context",
    description:
      "Price, DEX link and contract info for your token, inline.",
  },
  {
    icon: Palette,
    title: "Fully white-label",
    description:
      "Your colors, font and logo. It reads as part of your product.",
  },
  {
    icon: Code2,
    title: "Simple embed",
    description:
      "One script tag. Any stack.",
  },
  {
    icon: Globe2,
    title: "Multi-chain",
    description:
      "Nine chains live, led by Move-native Aptos alongside every major EVM network.",
  },
  {
    icon: BarChart3,
    title: "Analytics dashboard",
    description:
      "Conversations, satisfaction and question themes over time.",
  },
  {
    icon: Sparkles,
    title: "Operational record",
    description:
      "Every investigation stored and reviewable, for support, product and compliance.",
  },
  {
    icon: Plug,
    title: "Team integrations",
    description:
      "Escalations go to Slack, Discord or Telegram, and become tracked issues in Linear, GitHub or Jira.",
  },
  {
    icon: Send,
    title: "Telegram support",
    description:
      "The same engine in your community's Telegram, diagnosing members' transactions and wallets live.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">{`Features`}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Everything your protocol needs to stop firefighting support
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Built for on-chain products from the ground up.
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
