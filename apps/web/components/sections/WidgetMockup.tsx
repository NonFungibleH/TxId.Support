"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { clsx } from "clsx";

export type MockActivity = { status: "success" | "failed"; label: string; time: string };
export type MockExchange = { q: string; thinking: string; a: string };

// Defaults are the failed-swap conversation used on the homepage and
// /solutions. /how-it-works runs the same widget on a liquidation
// case, so the whole conversation is a prop.
const DEFAULT_ACTIVITY: MockActivity[] = [
  { status: "success", label: "Swap ETH → USDC", time: "2m ago" },
  { status: "success", label: "Approve USDC", time: "1h ago" },
  { status: "failed", label: "Failed swap", time: "3h ago" },
];

const DEFAULT_EXCHANGES: MockExchange[] = [
  {
    q: "Why did my swap fail?",
    thinking: "Diagnosing transaction…",
    a: "Your swap ran out of gas. Raise the gas limit in your wallet's advanced settings and retry. Want me to check if it cost you anything?",
  },
  {
    q: "Yes - did I lose any funds?",
    thinking: "Checking your wallet…",
    a: "No. The transaction reverted, so nothing left your wallet. You only paid $1.18 in gas. Retry with a higher limit and it should go through.",
  },
];

const TABS = ["Support", "Token", "Content"];

// Per-exchange phases: ask → think → type the answer → pause. The container is
// locked to its natural idle height on mount (so the page never shifts), and
// behaves like a real chat: content starts top-aligned and smooth-scrolls as
// messages append. Static final frame when the visitor prefers reduced motion.
const HOLDS = { idle: 2200, asked: 1050, thinking: 1650, pause: 2600, done: 5000 };

export function WidgetMockup({
  className,
  activityLabel = "Recent transactions",
  walletLabel = "0x1a2b...3c4d",
  activity = DEFAULT_ACTIVITY,
  exchanges = DEFAULT_EXCHANGES,
}: {
  className?: string;
  activityLabel?: string;
  walletLabel?: string;
  activity?: MockActivity[];
  exchanges?: MockExchange[];
}) {
  // idle, then (asked-i, thinking-i, answering-i, pause-i) per exchange.
  const phases: string[] = [
    "idle",
    ...exchanges.flatMap((ex, i) => [
      `asked-${i}`,
      `thinking-${i}`,
      ...(ex.a ? [`answering-${i}`] : []),
      `pause-${i}`,
    ]),
  ];
  const last = phases.length - 1;

  const [at, setAt] = useState(0);
  const [chars, setChars] = useState<number[]>(() => exchanges.map(() => 0));
  const [reduced, setReduced] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const phase = phases[at] ?? "idle";
  const kind = phase.split("-")[0]!;
  const idx = Number(phase.split("-")[1] ?? -1);
  // Has the run reached the given phase for exchange i?
  const reached = (k: string, i: number) => at >= phases.indexOf(`${k}-${i}`);

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

  // Phase machine: fixed holds advance to the next phase; the answering
  // phases advance from the typewriter effect below instead.
  useEffect(() => {
    if (reduced) {
      setAt(last);
      setChars(exchanges.map((e) => e.a.length));
      return;
    }
    if (kind === "answering") return;
    const hold =
      kind === "idle" ? HOLDS.idle
      : kind === "asked" ? HOLDS.asked
      : kind === "thinking" ? HOLDS.thinking
      : at === last ? HOLDS.done
      : HOLDS.pause;
    const t = setTimeout(() => {
      if (at === last) {
        setChars(exchanges.map(() => 0));
        setAt(0);
      } else {
        setAt(at + 1);
      }
    }, hold);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, reduced]);

  // Typewriter: reveal the answer char by char. The updater stays pure (no
  // setAt inside it) so StrictMode's double-invoke can't advance the phase
  // twice and overshoot the phases array.
  useEffect(() => {
    if (reduced || kind !== "answering") return;
    const text = exchanges[idx]!.a;
    const iv = setInterval(() => {
      setChars((prev) => {
        const c = prev[idx] ?? 0;
        if (c >= text.length) return prev;
        const next = [...prev];
        next[idx] = Math.min(c + 2, text.length);
        return next;
      });
    }, 28);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, reduced]);

  // Once the answer has fully typed out, advance to the pause phase. Clamped to
  // `last` so it can never index past the end of `phases`.
  useEffect(() => {
    if (reduced || kind !== "answering") return;
    if ((chars[idx] ?? 0) >= (exchanges[idx]!.a.length ?? 0)) {
      setAt((i) => Math.min(i + 1, last));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chars, at, reduced]);

  // Follow the conversation like a real chat window.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [at, chars, reduced]);

  return (
    <div
      className={clsx(
        "w-80 rounded-2xl overflow-hidden shadow-2xl shadow-accent/20",
        "bg-[#1e1e2e]",
        "font-sans text-sm",
        className
      )}
    >
      {/* Header + tabs unified - no separating borders */}
      <div className="bg-[#252540] px-4 pt-3 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/txid-icon-64.png" alt="TxID" width={20} height={20} className="rounded-md" />
            <span className="font-display font-semibold text-white text-xs">
              TxID
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
          <span className="font-mono text-xs text-white/35">{walletLabel}</span>
        </div>

        <div className="space-y-1.5 shrink-0">
          <p className="text-xs text-white/35 px-1">{activityLabel}</p>
          {activity.map((tx, i) => (
            <div
              key={i}
              className={clsx(
                "flex items-center justify-between bg-[#2a2a40] rounded-lg px-3 py-2 transition-all duration-500",
                tx.status === "failed" && at !== 0 && "ring-1 ring-accent/50"
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

        {exchanges.map((ex, i) => (
          <div key={ex.q} className="contents">
            {reached("asked", i) && (
              <div className="flex justify-end shrink-0 animate-msg-in">
                <div className="bg-accent rounded-xl rounded-br-sm px-3 py-2 max-w-[85%]">
                  <p className="text-white text-xs leading-relaxed">{ex.q}</p>
                </div>
              </div>
            )}

            {(phase === `thinking-${i}` || (!ex.a && phase === `pause-${i}`)) && (
              <div className="flex items-center gap-2 px-1 shrink-0 animate-msg-in">
                <Loader2 className="w-3 h-3 text-accent animate-spin" />
                <span className="text-xs text-white/40">{ex.thinking}</span>
              </div>
            )}

            {!!ex.a && reached("answering", i) && (
              <div className="bg-[#2a2a40] rounded-xl rounded-bl-sm p-3 max-w-[92%] shrink-0 animate-msg-in">
                <p className="text-white/90 text-xs leading-relaxed">
                  {ex.a.slice(0, chars[i] ?? 0)}
                  {phase === `answering-${i}` && (
                    <span className="animate-caret text-accent">▍</span>
                  )}
                </p>
              </div>
            )}
          </div>
        ))}

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
