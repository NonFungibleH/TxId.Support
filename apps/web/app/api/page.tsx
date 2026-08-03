import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { ApiCallMockup } from "@/components/sections/ApiCallMockup";
import {
  ArrowRight,
  Braces,
  Plug,
  Bot,
  Check,
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
  title: "API & MCP | TxID",
  description:
    "Access the same on-chain intelligence that powers TxID through API and MCP. Give your products, support teams, and AI agents the ability to understand transactions and explain failures from live blockchain data.",
  alternates: { canonical: "/api" },
};

const EXAMPLE_REQUEST = `POST /api/v1/diagnose

{
  "tx": "0x8f2a4c…d41c"
}`;

const EXAMPLE_RESPONSE = `{
  "status": "failed",
  "chain": "base",
  "cause": "custom_error",
  "error": "SlippageTooHigh",
  "explanation": "The price moved beyond
    the allowed tolerance.",
  "fix": "Retry with slippage at 0.5% or higher.",
  "tokenTransfers": [],
  "gas": {
    "verdict": "normal"
  }
}`;

const CAPABILITIES = [
  {
    icon: SearchCheck,
    title: "Transaction diagnosis",
    lead: "Understand:",
    items: [
      "Why a transaction failed",
      "Decoded errors",
      "Token transfers",
      "Gas outcomes",
      "Recommended fixes",
    ],
  },
  {
    icon: Activity,
    title: "Address intelligence",
    lead: "Check:",
    items: [
      "Wallet activity",
      "Transaction history",
      "Risk signals",
      "Sanctions screening where supported",
    ],
  },
  {
    icon: FileSearch,
    title: "Contract intelligence",
    lead: "Understand:",
    items: [
      "Live contract state",
      "Events",
      "Deployment information",
      "Upgrade history",
      "Verification status",
    ],
  },
  {
    icon: Coins,
    title: "Token intelligence",
    lead: "Access:",
    items: ["Supply information", "Decimals", "DEX pricing", "Allowances", "Approvals"],
  },
  {
    icon: Gauge,
    title: "Network intelligence",
    lead: "Monitor:",
    items: ["Gas conditions", "Fee recommendations", "RPC health"],
  },
];

const USE_CASES = [
  {
    icon: MessagesSquare,
    title: "Support platforms",
    paras: [
      "Give support agents the diagnosis before they respond.",
      "Connect TxID to Zendesk, Intercom, or internal tooling so teams understand the root cause instantly.",
    ],
  },
  {
    icon: Bot,
    title: "AI agents & copilots",
    paras: [
      "Give AI systems access to real blockchain intelligence.",
      "Answer questions like “Why did this transaction fail?” with verified on-chain evidence.",
    ],
  },
  {
    icon: Blocks,
    title: "Wallets & applications",
    paras: [
      "Explain failed transactions directly inside your product.",
      "Help users recover faster without leaving the experience.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Compliance & operations teams",
    paras: [
      "Add blockchain intelligence to existing workflows.",
      "Verify activity, understand transactions, and maintain a complete record.",
    ],
  },
];

// Three surfaces, each a full-width block rather than a small card: the REST
// block carries the worked request/response, so a 3-up grid can't hold it.
function SurfaceHeading({
  icon: Icon,
  label,
  title,
}: {
  icon: React.ElementType;
  label: string;
  title: string;
}) {
  return (
    <>
      <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-accent" />
      </div>
      <p className="font-mono text-[11px] text-accent mb-2 tracking-wider uppercase">{label}</p>
      <h3 className="font-display text-2xl font-bold text-white mb-3">{title}</h3>
    </>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-muted">
          <Check className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

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
          <div className="max-w-6xl mx-auto px-6 pt-10 pb-16 relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <div className="flex items-center gap-3 mb-4">
                <p className="font-mono text-sm text-accent">{`API & MCP`}</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  REST API live · MCP rolling out
                </span>
              </div>
              <h1 className="font-display text-5xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
                The diagnostic engine,
                <br />
                <span className="text-accent">wherever you need it</span>
              </h1>
              <p className="text-lg text-muted mb-3">
                Access the same on-chain intelligence that powers TxID through API
                and MCP.
              </p>
              <p className="text-lg text-muted mb-8">
                Give your products, support teams, and AI agents the ability to understand
                transactions, explain failures, and provide verified answers from live
                blockchain data.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button href="/contact" variant="primary" size="lg">
                  Get early access
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/check" variant="outline" size="lg">
                  Try it live
                </Button>
              </div>
            </FadeIn>
            <FadeIn delay={0.12}>
              <ApiCallMockup />
            </FadeIn>
            </div>
          </div>
        </section>

        {/* One engine, multiple surfaces */}
        <section className="pb-4">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-6 text-center">
                <p className="font-display text-lg font-semibold text-white mb-2">
                  One engine. Multiple surfaces.
                </p>
                <p className="font-mono text-sm text-accent mb-1.5">
                  Embedded · Telegram · API · MCP
                </p>
                <p className="text-sm text-muted">
                  Supporting EVM networks and Move-native Aptos.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Surface 1: REST API, with the worked example */}
        <section className="py-14">
          <div className="max-w-6xl mx-auto px-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
              <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 items-center">
                <FadeIn>
                  <SurfaceHeading
                    icon={Braces}
                    label="REST API"
                    title="Structured transaction intelligence"
                  />
                  <p className="text-muted leading-relaxed mb-3">
                    Send a transaction hash, wallet, or contract address.
                  </p>
                  <p className="text-muted leading-relaxed mb-5">
                    Receive a complete diagnosis, not raw traces or blockchain data dumps.
                  </p>
                  <p className="text-sm font-semibold text-white mb-2.5">TxID returns:</p>
                  <Bullets
                    items={[
                      "What happened",
                      "Why it happened",
                      "What the user should do next",
                    ]}
                  />
                </FadeIn>

                <FadeIn delay={0.1}>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted/60 mb-3">
                    Example
                  </p>
                  <div className="space-y-3">
                    <div className="bg-[#0d0d18] border border-[var(--border)] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[var(--border)]">
                        <span className="font-mono text-[11px] text-muted tracking-wider">REQUEST</span>
                      </div>
                      <pre className="p-5 text-xs leading-relaxed overflow-x-auto font-mono text-muted">
                        <code>{EXAMPLE_REQUEST}</code>
                      </pre>
                    </div>
                    <div className="bg-[#0d0d18] border border-[var(--border-accent)] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[var(--border)]">
                        <span className="font-mono text-[11px] text-accent tracking-wider">RESPONSE</span>
                      </div>
                      <pre className="p-5 text-xs leading-relaxed overflow-x-auto font-mono text-white/80">
                        <code>{EXAMPLE_RESPONSE}</code>
                      </pre>
                    </div>
                  </div>
                  <p className="text-xs text-muted/60 mt-3 font-mono">
                    Illustrative. Final schema may differ.
                  </p>
                </FadeIn>
              </div>
            </div>
          </div>
        </section>

        {/* Surfaces 2 and 3 */}
        <section className="pb-14">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-6">
            <FadeIn>
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <SurfaceHeading
                  icon={Plug}
                  label="MCP Server"
                  title="Give AI agents blockchain-native understanding"
                />
                <p className="text-muted leading-relaxed mb-5">
                  Connect TxID to MCP-compatible AI tools and give agents access to real
                  on-chain diagnostics.
                </p>
                <p className="text-sm font-semibold text-white mb-2.5">Agents can:</p>
                <Bullets
                  items={[
                    "Investigate failed transactions",
                    "Read contract state",
                    "Check wallet activity",
                    "Verify blockchain data",
                    "Provide evidence-backed answers",
                  ]}
                />
                <p className="mt-5 text-sm text-[#c8c8d8] border-l-2 border-accent/50 pl-4">
                  MCP access is rolling out.{" "}
                  <a href="/contact" className="text-accent hover:underline underline-offset-2">
                    Request early access
                  </a>
                  .
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.08}>
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <SurfaceHeading
                  icon={Bot}
                  label="Headless support"
                  title="Bring TxID intelligence into your own experience"
                />
                <p className="text-muted leading-relaxed mb-5">
                  Use the same diagnostic engine behind your own:
                </p>
                <Bullets
                  items={[
                    "In-app support",
                    "Discord bots",
                    "Customer support tooling",
                    "AI assistants",
                    "Internal workflows",
                  ]}
                />
                <p className="mt-5 text-sm text-[#c8c8d8] border-l-2 border-accent/50 pl-4">
                  Your users see your experience. TxID provides the intelligence underneath.
                </p>
              </div>
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
                  The same tools used by TxID
                </h2>
                <p className="text-muted max-w-xl mx-auto">
                  Every diagnostic capability available in the embedded experience can be
                  accessed programmatically.
                </p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CAPABILITIES.map((c, i) => (
                <FadeIn key={c.title} delay={(i % 3) * 0.06}>
                  <div className="h-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3">
                      <c.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-1.5">{c.title}</h3>
                    <p className="text-xs text-accent mb-3">{c.lead}</p>
                    <ul className="space-y-2">
                      {c.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-muted">
                          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent/70" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
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
                  Built for teams building on-chain products
                </h2>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 gap-4">
              {USE_CASES.map((u, i) => (
                <FadeIn key={u.title} delay={(i % 2) * 0.06}>
                  <div className="h-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
                    <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3">
                      <u.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-2">{u.title}</h3>
                    <div className="space-y-2">
                      {u.paras.map((p) => (
                        <p key={p} className="text-sm text-muted leading-relaxed">
                          {p}
                        </p>
                      ))}
                    </div>
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
                Join the early access group
              </h2>
              <p className="text-muted mb-2 max-w-lg mx-auto">
                We are onboarding a small group of design partners before launch.
              </p>
              <p className="text-muted mb-8 max-w-lg mx-auto">
                Tell us what you are building, and we&apos;ll help you integrate TxID.
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
