"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { clsx } from "clsx";

const TRANSACTIONS = [
  { status: "success", label: "Swap ETH → USDC", time: "2m ago" },
  { status: "success", label: "Approve USDC", time: "1h ago" },
  { status: "failed", label: "Failed swap", time: "3h ago" },
];

const TABS = ["Support", "Token", "Content"];

const Q1 = "Why did my swap fail?";
const A1 =
  "Your swap ran out of gas. Raise the gas limit in your wallet's advanced settings and retry. Want me to check if it cost you anything?";
const Q2 = "Yes — did I lose any funds?";
const A2 =
  "No. The transaction reverted, so nothing left your wallet. You only paid $1.18 in gas. Retry with a higher limit and it should go through.";

// Looping two-exchange conversation: diagnose the failed swap, then reassure
// that no funds were lost. The container is locked to its natural idle height
// on mount (so the page never shifts), and behaves like a real chat: content
// starts top-aligned and smooth-scrolls as messages append. Static final frame
// when the visitor prefers reduced motion.
const ORDER = [
  "idle",
  "asked1",
  "diagnosing",
  "answering1",
  "pause1",
  "asked2",
  "checking",
  "answering2",
  "done",
] as const;
type Phase = (typeof ORDER)[number];

const HOLDS: Partial<Record<Phase, number>> = {
  idle: 2200,
  asked1: 1000,
  diagnosing: 1800,
  pause1: 2600,
  asked2: 1100,
  checking: 1500,
  done: 5000,
};

export function WidgetMockup({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chars1, setChars1] = useState(0);
  const [chars2, setChars2] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const at = ORDER.indexOf(phase);
  const reached = (p: Phase) => at >= ORDER.indexOf(p);

  // Lock the conversation area to its natural idle height so appending
  // messages never grows the card or shifts the page around it.
  useLayoutEffect(() => {
    if (scrollRef.current && lockedHeight === null) {
      setLockedHeight(scrollRef.current.clientHeight);
    }
  }, [lockedHeight]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Phase machine: fixed holds advance to the next phase; the two answering
  // phases advance from the typewriter effect below instead.
  useEffect(() => {
    if (reduced) {
      setPhase("done");
      setChars1(A1.length);
      setChars2(A2.length);
      return;
    }
    const hold = HOLDS[phase];
    if (hold === undefined) return;
    const t = setTimeout(() => {
      if (phase === "done") {
        setChars1(0);
        setChars2(0);
        setPhase("idle");
      } else {
        setPhase(ORDER[at + 1]);
      }
    }, hold);
    return () => clearTimeout(t);
  }, [phase, at, reduced]);

  useEffect(() => {
    if (reduced || (phase !== "answering1" && phase !== "answering2")) return;
    const [text, setChars] = phase === "answering1" ? [A1, setChars1] : [A2, setChars2];
    const iv = setInterval(() => {
      setChars((c) => {
        if (c >= text.length) {
          clearInterval(iv);
          setPhase(ORDER[ORDER.indexOf(phase) + 1]);
          return c;
        }
        return Math.min(c + 2, text.length);
      });
    }, 28);
    return () => clearInterval(iv);
  }, [phase, reduced]);

  // Follow the conversation like a real chat window.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [phase, chars1, chars2, reduced]);

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

      {/* Conversation area */}
      <div
        ref={scrollRef}
        style={lockedHeight !== null ? { height: lockedHeight } : undefined}
        className="px-4 pt-4 overflow-hidden flex flex-col gap-3"
      >
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
                tx.status === "failed" && phase !== "idle" && "ring-1 ring-accent/50"
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

        {reached("asked1") && (
          <div className="flex justify-end shrink-0 animate-msg-in">
            <div className="bg-accent rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]">
              <p className="text-white text-xs leading-relaxed">{Q1}</p>
            </div>
          </div>
        )}

        {phase === "diagnosing" && (
          <div className="flex items-center gap-2 px-1 shrink-0 animate-msg-in">
            <Loader2 className="w-3 h-3 text-accent animate-spin" />
            <span className="text-xs text-white/40">Diagnosing transaction…</span>
          </div>
        )}

        {reached("answering1") && (
          <div className="bg-[#2a2a40] rounded-xl rounded-bl-sm p-3 max-w-[92%] shrink-0 animate-msg-in">
            <p className="text-white/90 text-xs leading-relaxed">
              {A1.slice(0, chars1)}
              {phase === "answering1" && (
                <span className="animate-caret text-accent">▍</span>
              )}
            </p>
          </div>
        )}

        {reached("asked2") && (
          <div className="flex justify-end shrink-0 animate-msg-in">
            <div className="bg-accent rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]">
              <p className="text-white text-xs leading-relaxed">{Q2}</p>
            </div>
          </div>
        )}

        {phase === "checking" && (
          <div className="flex items-center gap-2 px-1 shrink-0 animate-msg-in">
            <Loader2 className="w-3 h-3 text-accent animate-spin" />
            <span className="text-xs text-white/40">Checking your wallet…</span>
          </div>
        )}

        {reached("answering2") && (
          <div className="bg-[#2a2a40] rounded-xl rounded-bl-sm p-3 max-w-[92%] shrink-0 animate-msg-in">
            <p className="text-white/90 text-xs leading-relaxed">
              {A2.slice(0, chars2)}
              {phase === "answering2" && (
                <span className="animate-caret text-accent">▍</span>
              )}
            </p>
          </div>
        )}

        {/* Breathing room below the last message inside the scroll area */}
        <div className="shrink-0 h-1" />
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
