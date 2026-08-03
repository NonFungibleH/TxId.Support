"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, FileSearch, Search } from "lucide-react";
import { clsx } from "clsx";

// The hero visual: an investigation case card, not a chat widget. The widget
// mockup lives on /how-it-works now; the hero sells the engine - question in,
// evidence gathered live, verdict out, case recorded.
//
// Defaults are the homepage's failed-swap case. /how-it-works runs the same
// component on a liquidation dispute, so everything is a prop.
export type InvestigationStep = { label: string; detail?: string };

const DEFAULT_STEPS: InvestigationStep[] = [
  { label: "Fetched transaction", detail: "0x8f2a…d41c" },
  { label: "Replayed against pool state", detail: "block 21044210" },
  { label: "Decoded revert", detail: "SlippageTooHigh" },
  { label: "Checked wallet impact", detail: "no funds moved" },
];

const DEFAULT_VERDICT = (
  <>
    The price moved past your 0.3% slippage tolerance, so the contract rejected the swap.
    No funds left your wallet.{" "}
    <span className="text-emerald-400 font-medium">Fix: retry with slippage at 0.5%.</span>
  </>
);

const HOLDS = {
  idle: 1600,
  step: 950,
  verdict: 1500,
  delivered: 1300,
  recorded: 5200,
};

export function InvestigationMockup({
  className,
  caseId = "#4821",
  caseSubtitle = "Failed swap · Base",
  question = "Why did my swap fail?",
  steps = DEFAULT_STEPS,
  verdict = DEFAULT_VERDICT,
  verdictLabel,
  showLifecycleTail = true,
}: {
  className?: string;
  caseId?: string;
  caseSubtitle?: string;
  question?: string;
  steps?: InvestigationStep[];
  verdict?: React.ReactNode;
  verdictLabel?: string;
  showLifecycleTail?: boolean;
}) {
  // The full lifecycle, looping: question → one phase per evidence step →
  // verdict → answer delivered → filed to the case record for compliance.
  const phases = [
    "idle",
    ...steps.map((_, i) => `s${i + 1}`),
    "verdict",
    ...(showLifecycleTail ? ["delivered", "recorded"] : []),
  ];
  const holdFor = (p: string) =>
    p === "idle" ? HOLDS.idle
    : p === "verdict" ? HOLDS.verdict
    : p === "delivered" ? HOLDS.delivered
    : p === "recorded" ? HOLDS.recorded
    : HOLDS.step;

  const [at, setAt] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) setAt(phases.length - 1);
    // phases is derived from props that do not change after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setAt((i) => (i + 1) % phases.length), holdFor(phases[at]!));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, reduced]);

  const verdictAt = phases.indexOf("verdict");
  const showVerdict = at >= verdictAt;
  const showDelivered = showLifecycleTail && at >= phases.indexOf("delivered");
  const showRecorded = showLifecycleTail && at >= phases.indexOf("recorded");

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
            <p className="text-[13px] font-semibold text-white leading-tight">Case {caseId}</p>
            <p className="text-[10px] font-mono text-muted/70 leading-tight">{caseSubtitle}</p>
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
          <p className="text-sm text-white leading-snug">&ldquo;{question}&rdquo;</p>
        </div>

        {/* Evidence steps */}
        <ul className="space-y-2">
          {steps.map((s, i) => {
            const done = at > i + 1;
            const active = at === i + 1;
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
                {s.detail && (
                  <span className="ml-auto text-[10px] font-mono text-muted/60">{s.detail}</span>
                )}
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
          {verdictLabel && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted/70 mb-1.5">
              {verdictLabel}
            </p>
          )}
          <div className="text-xs text-[#d6d6e4] leading-relaxed">{verdict}</div>
        </div>

        {/* The lifecycle tail: answer delivered, then filed for compliance */}
        {showLifecycleTail && (
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
              <span className="text-muted/80">Case {caseId} filed</span>
              <span className="text-accent">Compliance-ready ✓</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
