import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import {
  ArrowRight,
  Braces,
  Plug,
  Bot,
  SearchCheck,
  ShieldCheck,
  Activity,
  FileSearch,
  Gauge,
  Coins,
  MessagesSquare,
  Blocks,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Platform: API + MCP | TxID Support",
  description:
    "The on-chain diagnostic engine behind TxID Support, available headless. A REST API and MCP server so your app, support desk, or AI tooling can diagnose transactions directly.",
  alternates: { canonical: "/platform" },
};

const PRODUCTS = [
  {
    icon: Braces,
    label: "REST API",
    title: "Diagnostics API",
    description:
      "Send a transaction hash, wallet, or contract address. Get back the structured diagnosis: decoded revert reason, events, token transfers, gas verdict, and the recommended fix.",
  },
  {
    icon: Plug,
    label: "MCP SERVER",
    title: "MCP for support",
    description:
      "Add TxID to any MCP-compatible client and give your AI tooling real on-chain diagnostic tools: transaction lookup, contract reads, sanctions screening, and more.",
  },
  {
    icon: Bot,
    label: "HEADLESS",
    title: "Support answers, anywhere",
    description:
      "The same protocol-aware answers the widget gives, delivered as an API response. Power your own in-app help, Discord bot, or support desk with it.",
  },
];

const CAPABILITIES = [
  { icon: SearchCheck, title: "Diagnose a transaction", detail: "Why it failed, what it did, token transfers, gas verdict" },
  { icon: ShieldCheck, title: "Screen an address", detail: "OFAC sanctions check via the on-chain Chainalysis oracle" },
  { icon: FileSearch, title: "Read a contract", detail: "Live state, event history, deployment, upgrade history, verification" },
  { icon: Coins, title: "Token intelligence", detail: "Supply, decimals, live DEX price, allowances and approvals" },
  { icon: Gauge, title: "Network health", detail: "Live gas, recommended max fee, RPC responsiveness per chain" },
  { icon: Activity, title: "Wallet context", detail: "Balances, recent activity, open approvals, risky unlimited grants" },
];

const USE_CASES = [
  {
    icon: MessagesSquare,
    title: "Support desks",
    description: "Pipe diagnoses into Zendesk, Intercom, or your own tooling so agents see the root cause before they reply.",
  },
  {
    icon: Bot,
    title: "AI agents and copilots",
    description: "Give any MCP-compatible assistant the ability to answer \"why did this transaction fail?\" with real chain data.",
  },
  {
    icon: Blocks,
    title: "Wallets and dapps",
    description: "Show users a plain-English explanation the moment a transaction fails, right inside your own product.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance teams",
    description: "Sanctions screening and contract verification as a single call, ready to slot into onboarding or monitoring flows.",
  },
];

const EXAMPLE_REQUEST = `POST /v1/diagnose
{
  "tx": "0x8f2a4c…d41c"
}`;

const EXAMPLE_RESPONSE = `{
  "status": "failed",
  "chain": "base",
  "cause": "custom_error",
  "error": "SlippageTooHigh",
  "explanation": "The price moved past the 0.3%
    tolerance while the swap was pending.",
  "fix": "Retry with slippage at 0.5% or higher.",
  "tokenTransfers": [],
  "gas": { "verdict": "normal" }
}`;

export default function PlatformPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
            }}
          />
          <div className="max-w-6xl mx-auto px-6 pt-10 pb-16 text-center relative">
            <FadeIn>
              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="font-mono text-sm text-accent">{`Platform`}</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  Coming soon
                </span>
              </div>
              <h1 className="font-display text-5xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
                The diagnostic engine.
                <br />
                <span className="text-accent">Without the widget.</span>
              </h1>
              <p className="text-lg text-muted max-w-2xl mx-auto mb-8">
                Everything TxID Support can diagnose, exposed as an API and an MCP
                server: so your product, your support desk, and your AI tooling can
                look up on-chain answers directly.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button href="/contact" variant="primary" size="lg">
                  Get early access
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/demo" variant="outline" size="lg">
                  See the widget live
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Three products */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-4">
              {PRODUCTS.map((p, i) => (
                <FadeIn key={p.title} delay={i * 0.08}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--border-accent)] transition-colors h-full">
                    <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                      <p.icon className="w-5 h-5 text-accent" />
                    </div>
                    <p className="font-mono text-[11px] text-accent mb-2 tracking-wider">{p.label}</p>
                    <h3 className="font-display font-semibold text-white mb-2">{p.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{p.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Example request/response */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm text-accent mb-3">{`How it will work`}</p>
                <h2 className="font-display text-4xl font-bold text-white mb-4">
                  One call in. A diagnosis out.
                </h2>
                <p className="text-muted max-w-xl mx-auto">
                  Not raw hex and trace dumps. The structured answer: what happened,
                  why, and the fix, ready to show a user or feed an agent.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted tracking-wider">REQUEST</span>
                  </div>
                  <pre className="p-5 text-xs leading-relaxed overflow-x-auto font-mono text-muted">
                    <code>{EXAMPLE_REQUEST}</code>
                  </pre>
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-accent)] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="font-mono text-[11px] text-accent tracking-wider">RESPONSE</span>
                  </div>
                  <pre className="p-5 text-xs leading-relaxed overflow-x-auto font-mono text-white/80">
                    <code>{EXAMPLE_RESPONSE}</code>
                  </pre>
                </div>
              </div>
              <p className="text-center text-xs text-muted/60 mt-4 font-mono">
                Illustrative. Final schema may differ.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* Capabilities */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm text-accent mb-3">{`Capabilities`}</p>
                <h2 className="font-display text-4xl font-bold text-white mb-4">
                  The same tools the widget uses
                </h2>
                <p className="text-muted max-w-xl mx-auto">
                  Every diagnostic the embedded product runs is a tool the platform
                  will expose. EVM chains today, Solana growing.
                </p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CAPABILITIES.map((c, i) => (
                <FadeIn key={c.title} delay={(i % 3) * 0.06}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors h-full">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                        <c.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-white text-sm mb-1">{c.title}</h3>
                        <p className="text-xs text-muted leading-relaxed">{c.detail}</p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm text-accent mb-3">{`Who it's for`}</p>
                <h2 className="font-display text-4xl font-bold text-white">
                  Built for more than protocols
                </h2>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {USE_CASES.map((u, i) => (
                <FadeIn key={u.title} delay={(i % 4) * 0.06}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 h-full">
                    <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3">
                      <u.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                    </div>
                    <h3 className="font-display font-semibold text-white text-sm mb-1.5">{u.title}</h3>
                    <p className="text-xs text-muted leading-relaxed">{u.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                Want in early?
              </h2>
              <p className="text-muted mb-8 max-w-lg mx-auto">
                We are onboarding a small group of design partners ahead of launch.
                Tell us what you would build and we will get you access first.
              </p>
              <Button href="/contact" variant="primary" size="lg">
                Talk to us
                <ArrowRight className="w-4 h-4" />
              </Button>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
