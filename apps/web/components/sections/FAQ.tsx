import { FadeIn } from "@/components/ui/FadeIn";

export const FAQS = [
  {
    q: "What exactly is TxID?",
    a: "It's a support layer you embed in your site or your Telegram. When a user asks a question, TxID reads the chain, works out what actually happened, and answers. If it can't resolve something, it hands your team the case with the work already done. And everything gets recorded, which matters more than you'd think once compliance starts asking.",
  },
  {
    q: "How does wallet detection work?",
    a: "When a user opens the agent, it silently reads the wallet address from whatever wallet provider is connected to your site (MetaMask, WalletConnect, Coinbase Wallet, etc.). It then uses that address to look up recent transactions and balances on the relevant chain. No signing or permission is required; it only reads public on-chain data.",
  },
  {
    q: "What stack does it work with?",
    a: "Any stack. The agent is embedded with a single script tag before your closing body tag. It works with React, Next.js, Vue, Svelte, or plain HTML. There's no SDK to install and no build step required.",
  },
  {
    q: "Do you support Aptos and Move?",
    a: "Yes, natively. Rather than adapt the EVM engine, TxID runs a second engine built for Move: module ABIs are read live from the Aptos fullnode, failed transactions decode Move abort codes into plain English, and users connect with Petra or paste an address. Aptos-only behaviors are covered too, including sponsored transactions, auth key rotation, and protocols that keep user funds in subaccount objects with delegated session keys.",
  },
  {
    q: "Is there a record of what the agent tells users?",
    a: "Yes. Every conversation is recorded with the investigation behind it: what was checked on-chain, what was found, and how it resolved. Support teams use it to see what users struggle with, product teams to see what to fix, and compliance teams to evidence exactly what a client was told and why.",
  },
  {
    q: "What counts as a conversation?",
    a: "A conversation starts when a user opens the agent and sends their first message. It ends after 30 minutes of inactivity. All messages in the same session count as one conversation, so a user asking 5 follow-up questions still uses only one of your monthly allowance.",
  },
  {
    q: "Can I try it before committing?",
    a: "Yes. The Evaluation tier gives you 150 conversations a month with wallet detection, transaction diagnostics, and docs Q&A, so you can prove TxID on your own protocol first. When you are ready to run it in production, we move you onto an Enterprise plan priced to your platform.",
  },
  {
    q: "Is it really white-label while we evaluate?",
    a: "Yes. Evaluation includes custom colours, font, and logo. Enterprise goes further with a full white-label experience, a custom agent name and avatar, and priority support.",
  },
  {
    q: "Which blockchains does TxID work with?",
    a: "TxID works across Ethereum, Base, BNB Chain, Polygon, Arbitrum, Optimism, Avalanche and Etherlink, plus Aptos (the Move-based L1). It detects the connected wallet on any of these and looks up balances and transactions on the relevant chain.",
  },
  {
    q: "Can it explain why a transaction failed?",
    a: "Yes. Diagnosing failed transactions is a core feature. When a user pastes a transaction hash or asks about a failure, the agent replays the transaction and explains the cause in plain English: out of gas, a require() revert reason, a custom contract error, or a Solidity panic such as an arithmetic overflow.",
  },
  {
    q: "Is wallet detection safe for my users?",
    a: "Yes. The agent only reads the public wallet address and public on-chain data. It never asks the user to sign a transaction, share a seed phrase, or grant any permission. There is nothing it can do to move or access funds.",
  },
  {
    q: "How do I add TxID to my site?",
    a: "Add one script tag before the closing body tag, then configure your branding, docs link, and contract addresses in the dashboard. It works with React, Next.js, Vue, Svelte, or plain HTML, with no SDK and no build step. Most protocols are live in under five minutes.",
  },
];

export function FAQ() {
  return (
    <section className="py-16">
      <div className="max-w-3xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="font-mono text-sm text-accent mb-3">{"FAQ"}</p>
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
                className="group rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] open:border-[var(--border-accent)] hover:border-[var(--border-accent)] hover:bg-white/[0.03] transition-colors"
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
              href="mailto:team@txid.support"
              className="text-accent hover:underline"
            >
              Email us
            </a>
 or{" "}
            <a href="/check" className="text-accent hover:underline">
              try it live
            </a>{" "}
            on a protocol you already use.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
