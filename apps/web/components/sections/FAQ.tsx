import { FadeIn } from "@/components/ui/FadeIn";
import { APP_URL } from "@/lib/config";

const FAQS = [
  {
    q: "What exactly is TxID Support?",
    a: "TxID Support is an AI support agent you embed in your DeFi protocol or token project site. It reads your user's connected wallet automatically, diagnoses failed transactions, answers questions from your documentation, and escalates to your team when it can't resolve something — all without leaving your site.",
  },
  {
    q: "How does wallet detection work?",
    a: "When a user opens the agent, it silently reads the wallet address from whatever wallet provider is connected to your site (MetaMask, WalletConnect, Coinbase Wallet, etc.). It then uses that address to look up recent transactions and balances on the relevant chain. No signing or permission is required — it only reads public on-chain data.",
  },
  {
    q: "What stack does it work with?",
    a: "Any stack. The agent is embedded with a single script tag before your closing body tag. It works with React, Next.js, Vue, Svelte, or plain HTML. There's no SDK to install and no build step required.",
  },
  {
    q: "What counts as a conversation?",
    a: "A conversation starts when a user opens the agent and sends their first message. It ends after 30 minutes of inactivity. All messages in the same session count as one conversation — so a user asking 5 follow-up questions still uses only one of your monthly allowance.",
  },
  {
    q: "Can I try it before committing to Pro?",
    a: "Yes — the Starter plan is free with no credit card required. You get 200 conversations per month, full wallet detection, transaction diagnostics, and docs Q&A. You can stay on free as long as you like and upgrade to Pro when you're ready to remove our branding or need higher volume.",
  },
  {
    q: "Is it really white-label on the free plan?",
    a: "The free plan shows a small 'Powered by TxID Support' tag. Pro removes it entirely and lets you set your own colours, font, and logo so the agent is indistinguishable from a native part of your product.",
  },
];

export function FAQ() {
  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="font-mono text-sm text-accent mb-3">{"// FAQ"}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Common questions
            </h2>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] open:border-[var(--border-accent)] transition-colors"
              >
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none text-white font-medium text-sm">
                  {faq.q}
                  <span className="shrink-0 text-muted group-open:text-accent transition-colors">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M4 6l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="group-open:rotate-180 transition-transform origin-center"
                      />
                    </svg>
                  </span>
                </summary>
                <p className="px-5 pb-5 text-sm text-muted leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-center text-sm text-muted mt-10">
            Still have questions?{" "}
            <a
              href="mailto:hello@txid.support"
              className="text-accent hover:underline"
            >
              Email us
            </a>{" "}
            or{" "}
            <a href={`${APP_URL}/sign-up`} className="text-accent hover:underline">
              start for free
            </a>{" "}
            and explore the dashboard.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
