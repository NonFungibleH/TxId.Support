"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { ArrowRight, CheckCircle2, XCircle, Wifi, Zap, BookOpen, TrendingUp, Activity } from "lucide-react";
import { APP_URL } from "@/lib/config";
import { clsx } from "clsx";

// ---------------------------------------------------------------------------
// Scenario data
// ---------------------------------------------------------------------------

const SCENARIOS = [
  {
    id: "tx",
    icon: Activity,
    label: "Failed Transaction",
    description: "User's swap reverted — AI explains why and what to do",
    messages: [
      {
        role: "ai" as const,
        text: "Hi 👋 I can see your wallet 0x1a2b...3c4d is connected on Ethereum. I can see your recent transactions — looks like one failed. Want me to explain what happened?",
        delay: 0,
      },
      {
        role: "user" as const,
        text: "Yes, my swap failed 3 hours ago. I'm confused.",
        delay: 800,
      },
      {
        role: "ai" as const,
        text: "Your swap of 1.5 ETH → USDC failed because of slippage tolerance. The price moved 1.8% between when you submitted and when the transaction was processed — but your slippage was set to 0.5%.\n\nFix: Go back to the swap, increase slippage to 2%, and try again. If the pool is volatile, try 3%.",
        delay: 1600,
      },
      {
        role: "user" as const,
        text: "Got it. Will I lose the gas fee?",
        delay: 2800,
      },
      {
        role: "ai" as const,
        text: "Yes — the gas was spent even though the swap didn't go through. That's ~$4.20 at current prices. Unfortunately that's how Ethereum works — miners are paid for the computation even on reverts.\n\nIf gas fees are a concern, try again during off-peak hours (UTC midnight–6am) when fees are typically 40–60% lower.",
        delay: 3600,
      },
    ],
  },
  {
    id: "docs",
    icon: BookOpen,
    label: "Docs Q&A",
    description: "AI answers from your indexed documentation",
    messages: [
      {
        role: "ai" as const,
        text: "Hi 👋 I'm trained on this protocol's documentation and can answer questions about how it works.",
        delay: 0,
      },
      {
        role: "user" as const,
        text: "How long does the vesting period last?",
        delay: 800,
      },
      {
        role: "ai" as const,
        text: "Based on the protocol docs: the standard vesting period is 24 months with a 6-month cliff.\n\nThis means:\n• Months 0–6: No tokens released (cliff period)\n• Month 6: 25% of your allocation unlocks\n• Months 7–24: Remaining 75% unlocks linearly (~4.2%/month)",
        delay: 1600,
      },
      {
        role: "user" as const,
        text: "Can I sell before vesting?",
        delay: 2800,
      },
      {
        role: "ai" as const,
        text: "No — unvested tokens are locked in the smart contract and cannot be transferred. Attempting to transfer them will revert.\n\nHowever, some protocols offer an early unlock at a penalty. I don't see that option in the current documentation — you may want to check with the team on Discord for the latest policy.",
        delay: 3600,
      },
    ],
  },
  {
    id: "token",
    icon: TrendingUp,
    label: "Token Info",
    description: "Live price, DEX links and contract data inline",
    messages: [
      {
        role: "ai" as const,
        text: "Hi 👋 I can pull live token data for this protocol. What would you like to know?",
        delay: 0,
      },
      {
        role: "user" as const,
        text: "What's the current price?",
        delay: 800,
      },
      {
        role: "ai" as const,
        text: "Current price: $0.0847 (+12.4% in the last 24h)\n24h volume: $2.1M\nMarket cap: $84.7M\n\nYou can trade it on Uniswap V3 — I can open that link for you.",
        delay: 1600,
      },
      {
        role: "user" as const,
        text: "Is the contract verified?",
        delay: 2800,
      },
      {
        role: "ai" as const,
        text: "Yes — the contract at 0x4a3b...9e2f is verified on Etherscan.\n\nKey details:\n• Deployed 14 months ago\n• Ownership renounced ✓\n• No mint function ✓\n• Liquidity locked until Dec 2025 ✓\n\nThis is a good sign for legitimacy.",
        delay: 3600,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Animated chat bubble
// ---------------------------------------------------------------------------

function ChatBubble({
  role,
  text,
  visible,
}: {
  role: "ai" | "user";
  text: string;
  visible: boolean;
}) {
  return (
    <div
      className={clsx(
        "transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        role === "user" ? "flex justify-end" : "flex justify-start"
      )}
    >
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line",
          role === "user"
            ? "bg-accent text-white rounded-br-sm"
            : "bg-[var(--bg-elevated)] text-white/90 rounded-bl-sm border border-[var(--border)]"
        )}
      >
        {text}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget demo shell
// ---------------------------------------------------------------------------

function WidgetDemo({ scenario }: { scenario: (typeof SCENARIOS)[number] }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  function play() {
    if (playing) return;
    setStep(0);
    setPlaying(true);
    scenario.messages.forEach((msg, i) => {
      setTimeout(() => {
        setStep(i + 1);
        if (i === scenario.messages.length - 1) setPlaying(false);
      }, msg.delay + 300);
    });
  }

  // Reset when scenario changes
  const [lastScenario, setLastScenario] = useState(scenario.id);
  if (scenario.id !== lastScenario) {
    setLastScenario(scenario.id);
    setStep(0);
    setPlaying(false);
  }

  return (
    <div className="w-80 rounded-2xl overflow-hidden shadow-2xl shadow-accent/10 border border-[var(--border)] bg-[#0c0c0c] font-sans text-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
          <span className="font-display font-semibold text-white text-xs">
            Protocol Support
          </span>
        </div>
        <Wifi className="w-3.5 h-3.5 text-muted" />
      </div>

      {/* Wallet bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span className="font-mono text-xs text-muted">0x1a2b...3c4d connected</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[320px]">
        {step === 0 && !playing && (
          <div className="flex items-center justify-center h-full">
            <button
              onClick={play}
              className="flex items-center gap-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent text-xs font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Play conversation
            </button>
          </div>
        )}
        {scenario.messages.slice(0, step).map((msg, i) => (
          <ChatBubble key={i} role={msg.role} text={msg.text} visible={i < step} />
        ))}
        {playing && step < scenario.messages.length && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl rounded-bl-sm px-3.5 py-2.5">
              <div className="flex gap-1 items-center h-3">
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="flex items-center gap-2 bg-[var(--bg-elevated)] rounded-xl px-3 py-2 border border-[var(--border)]">
          <span className="text-xs text-muted flex-1">Ask anything…</span>
          <div className="w-5 h-5 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <p className="text-center text-[10px] text-muted mt-2 font-mono">Powered by TxID Support</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0];

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-6">

          {/* Header */}
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">{"// Interactive demo"}</p>
            <h1 className="font-display text-5xl font-bold text-white mb-4">
              See it in action
            </h1>
            <p className="text-lg text-muted max-w-lg mx-auto">
              Pick a scenario below and hit play — this is exactly what your users will experience, inside your brand.
            </p>
          </div>

          {/* Demo layout */}
          <div className="flex flex-col lg:flex-row gap-12 items-start justify-center">

            {/* Scenario tabs */}
            <div className="flex flex-row lg:flex-col gap-3 lg:w-72 w-full">
              {SCENARIOS.map((s) => {
                const Icon = s.icon;
                const active = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={clsx(
                      "flex-1 lg:flex-none text-left rounded-xl border p-4 transition-all",
                      active
                        ? "border-accent bg-accent-muted"
                        : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-accent)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon className={clsx("w-4 h-4 shrink-0", active ? "text-accent" : "text-muted")} />
                      <span className={clsx("font-display font-semibold text-sm", active ? "text-white" : "text-muted")}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed hidden lg:block">{s.description}</p>
                  </button>
                );
              })}

              {/* What powers this */}
              <div className="hidden lg:block mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">What powers this</p>
                <ul className="space-y-2">
                  {[
                    "Claude AI (Anthropic)",
                    "On-chain data via Moralis",
                    "Your docs, indexed with RAG",
                    "DexScreener live prices",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-muted">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Widget */}
            <div className="flex justify-center lg:justify-start flex-1">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-2xl blur-3xl scale-90"
                  style={{ background: "rgba(99, 102, 241, 0.18)" }}
                />
                <WidgetDemo key={activeId} scenario={scenario} />
              </div>
            </div>

            {/* Right callout */}
            <div className="lg:w-64 w-full space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <p className="font-display font-semibold text-white text-sm mb-1">
                  This widget is fully white-label
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Your colours, your font, your logo. Users never know it&apos;s TxID Support.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
                <p className="font-display font-semibold text-white text-sm mb-1">
                  Live in under 5 minutes
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  Configure your branding, paste your docs URL, copy one script tag. Done.
                </p>
              </div>

              <div className="rounded-xl border border-accent/20 bg-accent-muted p-5">
                <p className="font-mono text-xs text-accent mb-2">Free during beta</p>
                <p className="text-xs text-muted leading-relaxed">
                  Early protocols get 50 conversations/month free. No credit card, no commitment.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-20 text-center">
            <p className="text-muted text-sm mb-6">
              Ready to add this to your protocol?
            </p>
            <Button href={`${APP_URL}/sign-up`} variant="primary" size="lg">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="text-xs text-muted mt-4">
              No credit card · Configure in minutes · Free tier forever
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
