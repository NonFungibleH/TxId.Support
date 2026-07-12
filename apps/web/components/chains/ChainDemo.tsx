"use client";

import { useState, useEffect, useRef } from "react";
import { clsx } from "clsx";
import { Wifi } from "lucide-react";
import type { DemoMessage } from "@/lib/chains";

function ChatBubble({ role, text }: { role: "ai" | "user"; text: string }) {
  return (
    <div className={clsx("flex animate-in fade-in slide-in-from-bottom-2 duration-500", role === "user" ? "justify-end" : "justify-start")}>
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

function TypingIndicator({ role }: { role: "ai" | "user" }) {
  return (
    <div className={clsx("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "rounded-2xl px-3.5 py-2.5",
          role === "user" ? "bg-accent rounded-br-sm" : "bg-[var(--bg-elevated)] border border-[var(--border)] rounded-bl-sm"
        )}
      >
        <div className="flex gap-1 items-center h-3">
          <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Scripted, self-playing support-chat demo for a chain landing page. Colour is
 * inherited from the page wrapper (which overrides --accent), so this stays
 * chain-agnostic. Plays once on view, then offers a replay.
 */
export function ChainDemo({
  messages,
  chainName,
  walletLabel,
}: {
  messages: DemoMessage[];
  chainName: string;
  walletLabel: string;
}) {
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function startAnimation() {
    timerIds.current.forEach(clearTimeout);
    timerIds.current = [];
    setStep(0);
    setDone(false);
    messages.forEach((msg, i) => {
      const id = setTimeout(() => {
        setStep(i + 1);
        if (i === messages.length - 1) setDone(true);
      }, msg.delay + 600);
      timerIds.current.push(id);
    });
  }

  // Start only when scrolled into view, so the animation isn't half-over before
  // the user sees it.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          setStarted(true);
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      timerIds.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [step]);

  const nextMessage = messages[step];
  const isTyping = started && !done && step < messages.length;
  const typingRole = nextMessage?.role ?? "ai";

  return (
    <div
      ref={rootRef}
      className="w-[340px] max-w-full rounded-2xl overflow-hidden shadow-2xl shadow-accent/10 border border-[var(--border)] bg-[#0c0c0c] font-sans text-sm flex flex-col"
      style={{ height: 520 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
          <span className="font-display font-semibold text-white text-xs">{chainName} Support</span>
        </div>
        <Wifi className="w-3.5 h-3.5 text-muted" />
      </div>

      {/* Wallet bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span className="font-mono text-xs text-muted">{walletLabel}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.slice(0, step).map((msg, i) => (
          <ChatBubble key={i} role={msg.role} text={msg.text} />
        ))}
        {isTyping && <TypingIndicator role={typingRole} />}
      </div>

      {/* Input bar (decorative) */}
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
