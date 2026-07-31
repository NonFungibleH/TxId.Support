"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, FileSearch, Search } from "lucide-react";
import { clsx } from "clsx";

// The hero visual: an investigation case card, not a chat widget. The widget
// mockup lives on /how-it-works now; the hero sells the engine - question in,
// evidence gathered live, verdict out, case recorded.
const STEPS = [
  { label: "Fetched transaction", detail: "0x8f2a…d41c" },
  { label: "Replayed against pool state", detail: "block 21044210" },
  { label: "Decoded revert", detail: "SlippageTooHigh" },
  { label: "Checked wallet impact", detail: "no funds moved" },
];

// The full lifecycle, looping: question → evidence steps → verdict →
// answer delivered → filed to the case record for compliance.
const PHASES = ["idle", "s1", "s2", "s3", "s4", "verdict", "delivered", "recorded"] as const;
type Phase = (typeof PHASES)[number];
const HOLDS: Record<Phase, number> = {
  idle: 1600,
  s1: 900,
  s2: 1000,
  s3: 1000,
  s4: 900,
  verdict: 1500,
  delivered: 1300,
  recorded: 5200,
};

export function InvestigationMockup({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) {
      setPhase("recorded");
      return;
    }
  }, []);

  useEffect(() => {
    if (reduced) return;
    const idx = PHASES.indexOf(phase);
    const next = PHASES[(idx + 1) % PHASES.length];
    const t = setTimeout(() => setPhase(next), HOLDS[phase]);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const at = PHASES.indexOf(phase);
  const stepDone = (i: number) => at > i; // s1 done once past index 1, etc.
  const stepActive = (i: number) => at === i;
  const showVerdict = at >= PHASES.indexOf("verdict");
  const showDelivered = at >= PHASES.indexOf("delivered");
  const showRecorded = at >= PHASES.indexOf("recorded");

  return (
    <div
      className={clsx(
        "w-full max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] shadow-2xl shadow-black/40 overflow-hidden",
        className,
      )}
    >
      {/* Case header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[#10101d]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
            <FileSearch className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white leading-tight">Case #4821</p>
            <p className="text-[10px] font-mono text-muted/70 leading-tight">Failed swap · Base</p>
          </div>
        </div>
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono border transition-colors duration-500",
            showVerdict
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-accent/40 bg-accent/10 text-accent",
          )}
        >
          <span
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              showVerdict ? "bg-emerald-400" : "bg-accent animate-pulse",
            )}
          />
          {showVerdict ? "Resolved" : "Investigating"}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* The user's question */}
        <div className="flex items-start gap-2.5">
          <Search className="w-3.5 h-3.5 text-muted/60 mt-0.5 shrink-0" />
          <p className="text-sm text-white leading-snug">&ldquo;Why did my swap fail?&rdquo;</p>
        </div>

        {/* Evidence steps */}
        <ul className="space-y-2">
          {STEPS.map((s, i) => {
            const done = stepDone(i + 1);
            const active = stepActive(i + 1);
            const visible = done || active;
            return (
              <li
                key={s.label}
                className={clsx(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-500",
                  visible
                    ? "border-[var(--border)] bg-[#12121f] opacity-100 translate-y-0"
                    : "border-transparent bg-transparent opacity-25 translate-y-0.5",
                )}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : active ? (
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-muted/30 shrink-0" />
                )}
                <span className="text-xs text-[#c8c8d8]">{s.label}</span>
                <span className="ml-auto text-[10px] font-mono text-muted/60">{s.detail}</span>
              </li>
            );
          })}
        </ul>

        {/* Verdict */}
        <div
          className={clsx(
            "rounded-lg border px-3.5 py-3 transition-all duration-700",
            showVerdict
              ? "border-emerald-500/30 bg-emerald-500/5 opacity-100 translate-y-0"
              : "border-transparent bg-transparent opacity-0 translate-y-1",
          )}
        >
          <p className="text-xs text-[#d6d6e4] leading-relaxed">
            The price moved past your 0.3% slippage tolerance, so the contract rejected the swap.
            No funds left your wallet. <span className="text-emerald-400 font-medium">Fix: retry with slippage at 0.5%.</span>
          </p>
        </div>

        {/* The lifecycle tail: answer delivered, then filed for compliance */}
        <div className="space-y-1.5">
          <div
            className={clsx(
              "flex items-center gap-2 text-[10px] font-mono transition-all duration-500",
              showDelivered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-0.5",
            )}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-muted/80">Answer delivered to the user</span>
          </div>
          <div
            className={clsx(
              "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[10px] font-mono transition-all duration-700",
              showRecorded
                ? "border-accent/30 bg-accent/5 opacity-100 translate-y-0"
                : "border-transparent opacity-0 translate-y-0.5",
            )}
          >
            <span className="text-muted/80">Case #4821 filed: evidence · reasoning · resolution</span>
            <span className="text-accent">Compliance-ready ✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}
