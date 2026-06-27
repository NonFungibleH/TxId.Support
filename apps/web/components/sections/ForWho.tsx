import { Check } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { APP_URL } from "@/lib/config";

const SEGMENTS = [
  {
    badge: "Support tool",
    heading: "DeFi protocols",
    subheading: "Support your existing users",
    description:
      "When users hit a failed swap, wrong-network error, or a question your docs should answer — they need help that already knows their on-chain context. Not a generic chatbot.",
    features: [
      "Transaction diagnostics — failed swaps explained in plain English",
      "Wallet-aware — the bot already knows what the user's wallet did",
      "Docs Q&A — trained on your protocol documentation",
      "Escalation tickets — clean hand-off when the bot can't resolve",
    ],
    cta: "Add to your protocol",
    ctaHref: `${APP_URL}/sign-up`,
    highlight: true,
  },
  {
    badge: "Discovery hub",
    heading: "Token projects",
    subheading: "Educate and onboard your community",
    description:
      "New community members want to know where to buy, how to stake, what the tokenomics look like, and where to get involved. Answer all of it automatically — embedded in your site.",
    features: [
      "Token price & DEX links — live data, always current",
      "Tokenomics explainer — supply, distribution, vesting",
      "Staking & rewards — how to participate, what to expect",
      "Community links — Discord, Telegram, Twitter, whitepaper",
    ],
    cta: "Set up your hub",
    ctaHref: `${APP_URL}/sign-up`,
    highlight: false,
  },
];

export function ForWho() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="font-mono text-sm text-accent mb-3">{"// Who it's for"}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Two types of project. One widget.
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Whether you&apos;re running a live protocol or launching a token community,
              TxID Support fits the same way — embedded in your site, trained on your content.
            </p>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-6">
          {SEGMENTS.map((seg, i) => (
            <FadeIn key={seg.heading} delay={i * 0.1}>
              <div
                className={`relative rounded-2xl border p-8 flex flex-col h-full ${
                  seg.highlight
                    ? "bg-accent-muted border-accent shadow-lg shadow-accent/10"
                    : "bg-[var(--bg-surface)] border-[var(--border)]"
                }`}
              >
                <span className="inline-block font-mono text-[10px] uppercase tracking-widest text-accent mb-4 px-2 py-1 rounded border border-accent/30 bg-accent/10 self-start">
                  {seg.badge}
                </span>

                <h3 className="font-display text-2xl font-bold text-white mb-1">
                  {seg.heading}
                </h3>
                <p className="text-sm text-accent mb-4">{seg.subheading}</p>
                <p className="text-sm text-muted leading-relaxed mb-6">
                  {seg.description}
                </p>

                <ul className="space-y-3 mb-8 flex-1">
                  {seg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  href={seg.ctaHref}
                  variant={seg.highlight ? "primary" : "outline"}
                  className="w-full justify-center"
                >
                  {seg.cta}
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
