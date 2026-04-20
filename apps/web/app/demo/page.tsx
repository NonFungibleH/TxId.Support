"use client";

import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { ArrowRight, CheckCircle2, Wifi, BookOpen, TrendingUp, Activity } from "lucide-react";
import { APP_URL } from "@/lib/config";
import { clsx } from "clsx";

// ---------------------------------------------------------------------------
// Scenario data — delays are reading-paced (slower than real typing)
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
        text: "Hi 👋 I can see your wallet 0x1a2b...3c4d is connected. Looks like you had a failed transaction 3 hours ago — want me to explain what happened?",
        delay: 0,
      },
      {
        role: "user" as const,
        text: "Yes please, I'm confused.",
        delay: 2500,
      },
      {
        role: "ai" as const,
        text: "Your swap of 1.5 ETH → USDC failed due to slippage. The price moved 1.8% while your transaction was pending — but your slippage tolerance was set to 0.5%.\n\nFix: increase slippage to 2% and retry. If the pool is volatile, use 3%.",
        delay: 5000,
      },
      {
        role: "user" as const,
        text: "Will I lose the gas fee?",
        delay: 9000,
      },
      {
        role: "ai" as const,
        text: "Yes — gas is charged even on failed transactions (~$4.20 at current prices). Miners are paid for computation regardless of outcome.\n\nTip: retry during off-peak hours (UTC midnight–6am) when fees are 40–60% lower.",
        delay: 11500,
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
        text: "Hi 👋 I'm trained on this protocol's documentation. Ask me anything about how it works.",
        delay: 0,
      },
      {
        role: "user" as const,
        text: "How long does the vesting period last?",
        delay: 2500,
      },
      {
        role: "ai" as const,
        text: "Based on the protocol docs: 24 months total, with a 6-month cliff.\n\n• Months 0–6: nothing released\n• Month 6: 25% unlocks\n• Months 7–24: remaining 75% releases linearly (~4.2%/month)",
        delay: 5000,
      },
      {
        role: "user" as const,
        text: "Can I sell before vesting ends?",
        delay: 9500,
      },
      {
        role: "ai" as const,
        text: "No — unvested tokens are locked in the smart contract. Any transfer attempt will revert.\n\nSome protocols offer early unlock at a penalty — I don't see that option in the current docs. Check with the team on Discord for the latest.",
        delay: 12000,
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
        delay: 2500,
      },
      {
        role: "ai" as const,
        text: "Current price: $0.0847 (+12.4% in 24h)\n24h volume: $2.1M\nMarket cap: $84.7M\n\nYou can trade it directly on Uniswap V3.",
        delay: 5000,
      },
      {
        role: "user" as const,
        text: "Is the contract verified?",
        delay: 8500,
      },
      {
        role: "ai" as const,
        text: "Yes — verified on Etherscan at 0x4a3b...9e2f.\n\n✓ Deployed 14 months ago\n✓ Ownership renounced\n✓ No mint function\n✓ Liquidity locked until Dec 2025\n\nAll green flags.",
        delay: 11000,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Animated chat bubble
// ---------------------------------------------------------------------------

function ChatBubble({ role, text }: { role: "ai" | "user"; text: string }) {
  return (
    <div className={clsx("flex animate-in fade-in slide-in-from-bottom-2 duration-400", role === "user" ? "justify-end" : "justify-start")}>
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

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl rounded-bl-sm px-3.5 py-2.5">
        <div className="flex gap-1 items-center h-3">
          <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget demo shell
// ---------------------------------------------------------------------------

function WidgetDemo({ scenario }: { scenario: (typeof SCENARIOS)[number] }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  function startAnimation() {
    timerIds.current.forEach(clearTimeout);
    timerIds.current = [];
    setStep(0);
    setDone(false);

    scenario.messages.forEach((msg, i) => {
      const id = setTimeout(() => {
        setStep(i + 1);
        if (i === scenario.messages.length - 1) setDone(true);
      }, msg.delay + 600);
      timerIds.current.push(id);
    });
  }

  useEffect(() => {
    const warmup = setTimeout(startAnimation, 800);
    return () => {
      clearTimeout(warmup);
      timerIds.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom as messages appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [step]);

  // Only show the typing indicator when the AI is about to respond
  // (i.e. the next message to appear is from the AI)
  const nextMessage = scenario.messages[step]
  const aiIsTyping = !done && step < scenario.messages.length && step > 0 && nextMessage?.role === "ai"
  // Before any message appears, show the AI typing indicator (AI opens the conversation)
  const waitingForFirstMessage = step === 0

  return (
    <div className="w-[340px] rounded-2xl overflow-hidden shadow-2xl shadow-accent/10 border border-[var(--border)] bg-[#0c0c0c] font-sans text-sm flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
          <span className="font-display font-semibold text-white text-xs">Protocol Support</span>
        </div>
        <Wifi className="w-3.5 h-3.5 text-muted" />
      </div>

      {/* Wallet bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span className="font-mono text-xs text-muted">0x1a2b...3c4d connected</span>
      </div>

      {/* Messages — fixed height, scrolls internally */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Initial AI typing indicator before first message */}
        {waitingForFirstMessage && <TypingIndicator />}
        {scenario.messages.slice(0, step).map((msg, i) => (
          <ChatBubble key={i} role={msg.role} text={msg.text} />
        ))}
        {/* AI typing indicator — only when AI is about to respond, never for user messages */}
        {aiIsTyping && <TypingIndicator />}
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
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-muted font-mono">Powered by TxID Support</p>
          {done && (
            <button onClick={startAnimation} className="text-[10px] text-accent hover:underline font-mono">
              ↺ replay
            </button>
          )}
        </div>
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
              Watch how your users get instant answers — inside your own brand.
            </p>
          </div>

          {/* Demo layout */}
          <div className="flex flex-col lg:flex-row gap-10 items-start justify-center">

            {/* Left: scenario selector */}
            <div className="flex flex-row lg:flex-col gap-3 lg:w-64 w-full shrink-0">
              <p className="hidden lg:block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Try a scenario</p>
              {SCENARIOS.map((s) => {
                const Icon = s.icon;
                const active = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={clsx(
                      "flex-1 lg:flex-none text-left rounded-xl border p-4 transition-all cursor-pointer",
                      active
                        ? "border-accent bg-accent-muted"
                        : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-accent)]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      <Icon className={clsx("w-4 h-4 shrink-0", active ? "text-accent" : "text-muted")} />
                      <span className={clsx("font-display font-semibold text-sm", active ? "text-white" : "text-muted")}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed hidden lg:block">{s.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Centre: widget */}
            <div className="flex justify-center flex-1">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-3xl scale-90" style={{ background: "rgba(99,102,241,0.18)" }} />
                <WidgetDemo key={activeId} scenario={scenario} />
              </div>
            </div>

            {/* Right: about this product — clearly NOT interactive */}
            <div className="lg:w-56 w-full shrink-0">
              <p className="hidden lg:block text-xs font-semibold text-muted uppercase tracking-wider mb-4">About TxID Support</p>
              <div className="space-y-3">
                {[
                  { title: "Fully white-label", body: "Your colours, font, and logo. Users never know it's TxID Support." },
                  { title: "Live in under 5 minutes", body: "Configure branding, paste your docs URL, copy one script tag." },
                  { title: "Free trial", body: "50 conversations/month free. No credit card required." },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                    <p className="font-display font-semibold text-white text-xs mb-1">{item.title}</p>
                    <p className="text-xs text-muted leading-relaxed">{item.body}</p>
                  </div>
                ))}

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Powered by</p>
                  <ul className="space-y-1.5">
                    {["Claude AI (Anthropic)", "On-chain data · Moralis", "RAG doc indexing", "DexScreener prices"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-muted">
                        <CheckCircle2 className="w-3 h-3 text-accent shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-20 text-center">
            <p className="text-muted text-sm mb-6">Ready to add this to your protocol?</p>
            <Button href={`${APP_URL}/sign-up`} variant="primary" size="lg">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Button>
            <p className="text-xs text-muted mt-4">
              No credit card · Set up in minutes · 50 conversations/month free
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
