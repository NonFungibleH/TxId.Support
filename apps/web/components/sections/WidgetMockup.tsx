"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { clsx } from "clsx";

const TRANSACTIONS = [
  { status: "success", label: "Swap ETH → USDC", time: "2m ago" },
  { status: "success", label: "Approve USDC", time: "1h ago" },
  { status: "failed", label: "Failed swap", time: "3h ago" },
];

const TABS = ["Support", "Token", "Content"];

const QUESTION = "Why did my swap fail?";
const ANSWER =
  "Your swap ran out of gas. Raise the gas limit in your wallet's advanced settings and retry. Want me to walk you through it?";

// Looping conversation scene: idle → question slides in → "Diagnosing…" →
// answer streams in → hold → reset. Static final frame when the visitor
// prefers reduced motion.
type Phase = "idle" | "asked" | "diagnosing" | "answering" | "done";

export function WidgetMockup({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chars, setChars] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) {
      setPhase("done");
      setChars(ANSWER.length);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    if (phase === "idle") t = setTimeout(() => setPhase("asked"), 2200);
    else if (phase === "asked") t = setTimeout(() => setPhase("diagnosing"), 1000);
    else if (phase === "diagnosing") t = setTimeout(() => setPhase("answering"), 1800);
    else if (phase === "done")
      t = setTimeout(() => {
        setChars(0);
        setPhase("idle");
      }, 4500);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  useEffect(() => {
    if (phase !== "answering" || reduced) return;
    const iv = setInterval(() => {
      setChars((c) => {
        if (c >= ANSWER.length) {
          clearInterval(iv);
          setPhase("done");
          return c;
        }
        return Math.min(c + 2, ANSWER.length);
      });
    }, 28);
    return () => clearInterval(iv);
  }, [phase, reduced]);

  const conversationStarted = phase !== "idle";
  const answerVisible = phase === "answering" || phase === "done";

  return (
    <div
      className={clsx(
        "w-80 rounded-2xl overflow-hidden shadow-2xl shadow-accent/20",
        "bg-[#1e1e2e]",
        "font-sans text-sm",
        className
      )}
    >
      {/* Header + tabs unified — no separating borders */}
      <div className="bg-[#252540] px-4 pt-3 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/txid-icon-64.png" alt="TxID Support" width={20} height={20} className="rounded-md" />
            <span className="font-display font-semibold text-white text-xs">
              TxID Support
            </span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/60 animate-pulse" />
        </div>

        <div className="flex">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={clsx(
                "flex-1 pb-2.5 text-xs transition-colors",
                i === 0
                  ? "text-accent border-b-2 border-accent font-medium"
                  : "text-white/30"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation area: fixed height, bottom-anchored like a real chat so
          new messages push earlier content up and out of view. */}
      <div className="px-4 pt-4 h-[312px] overflow-hidden flex flex-col justify-end gap-3">
        <div className="bg-[#2a2a40] rounded-xl p-3 shrink-0">
          <p className="text-white/90 text-xs leading-relaxed">
            Hi 👋 I&apos;m your support agent. I can diagnose transactions and
            answer questions about the protocol.
          </p>
        </div>

        <div className="flex items-center gap-2 px-1 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="font-mono text-xs text-white/35">0x1a2b...3c4d</span>
        </div>

        <div className="space-y-1.5 shrink-0">
          <p className="text-xs text-white/35 px-1">Recent transactions</p>
          {TRANSACTIONS.map((tx, i) => (
            <div
              key={i}
              className={clsx(
                "flex items-center justify-between bg-[#2a2a40] rounded-lg px-3 py-2 transition-all duration-500",
                tx.status === "failed" && conversationStarted && "ring-1 ring-accent/50"
              )}
            >
              <div className="flex items-center gap-2">
                {tx.status === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                )}
                <span className="text-xs text-white/80">{tx.label}</span>
              </div>
              <span className="text-xs text-white/30 font-mono">{tx.time}</span>
            </div>
          ))}
        </div>

        {conversationStarted && (
          <div className="flex justify-end shrink-0 animate-msg-in">
            <div className="bg-accent rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]">
              <p className="text-white text-xs leading-relaxed">{QUESTION}</p>
            </div>
          </div>
        )}

        {phase === "diagnosing" && (
          <div className="flex items-center gap-2 px-1 shrink-0 animate-msg-in">
            <Loader2 className="w-3 h-3 text-accent animate-spin" />
            <span className="text-xs text-white/40">Diagnosing transaction…</span>
          </div>
        )}

        {answerVisible && (
          <div className="bg-[#2a2a40] rounded-xl rounded-bl-sm p-3 max-w-[92%] shrink-0 animate-msg-in">
            <p className="text-white/90 text-xs leading-relaxed">
              {ANSWER.slice(0, chars)}
              {phase === "answering" && (
                <span className="animate-caret text-accent">▍</span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 pt-3">
        <div className="flex items-center gap-2 bg-[#2a2a40] rounded-xl px-3 py-2.5">
          <span className="text-xs text-white/30 flex-1">
            Ask anything…
          </span>
          <div className="w-5 h-5 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
