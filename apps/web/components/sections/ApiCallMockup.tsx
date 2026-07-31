"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

// The /api hero visual: one diagnose call, looping. Request appears, the
// engine "works" (tool lines tick past), then the response streams in.
const REQUEST = `POST /api/v1/diagnose
{ "tx": "0x8f2a4c…d41c" }`;

const WORK = ["fetch transaction", "replay at block 21044210", "decode revert", "check wallet impact"];

const RESPONSE = `{
  "status": "failed",
  "cause": "custom_error",
  "error": "SlippageTooHigh",
  "explanation": "Price moved past the
    0.3% tolerance while pending.",
  "fix": "Retry with slippage ≥ 0.5%.",
  "walletImpact": "none",
  "case": { "id": "4821", "recorded": true }
}`;

type Phase = "request" | "work" | "respond" | "hold";

export function ApiCallMockup({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("request");
  const [workStep, setWorkStep] = useState(0);
  const [chars, setChars] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) {
      setPhase("hold");
      setWorkStep(WORK.length);
      setChars(RESPONSE.length);
    }
  }, []);

  useEffect(() => {
    if (reduced) return;
    if (phase === "request") {
      const t = setTimeout(() => setPhase("work"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "work") {
      if (workStep >= WORK.length) {
        const t = setTimeout(() => setPhase("respond"), 300);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setWorkStep(s => s + 1), 550);
      return () => clearTimeout(t);
    }
    if (phase === "respond") {
      if (chars >= RESPONSE.length) {
        const t = setTimeout(() => setPhase("hold"), 200);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setChars(c => Math.min(RESPONSE.length, c + 7)), 24);
      return () => clearTimeout(t);
    }
    // hold → loop
    const t = setTimeout(() => {
      setWorkStep(0);
      setChars(0);
      setPhase("request");
    }, 5200);
    return () => clearTimeout(t);
  }, [phase, workStep, chars, reduced]);

  const showWork = phase !== "request";
  const showResponse = phase === "respond" || phase === "hold";

  return (
    <div
      className={clsx(
        "w-full max-w-md mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] shadow-2xl shadow-black/40 overflow-hidden font-mono text-[12px] leading-relaxed",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[var(--border)] bg-[#10101d]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-muted/60">diagnose.sh</span>
      </div>
      <div className="p-4 space-y-3 min-h-[330px]">
        <pre className="text-[#a5b4fc] whitespace-pre-wrap">{REQUEST}</pre>

        <div className={clsx("space-y-1 transition-opacity duration-300", showWork ? "opacity-100" : "opacity-0")}>
          {WORK.map((w, i) => (
            <p
              key={w}
              className={clsx(
                "text-[11px] transition-opacity duration-300",
                i < workStep ? "text-muted/70 opacity-100" : "opacity-0",
              )}
            >
              <span className="text-emerald-400">✓</span> {w}
            </p>
          ))}
        </div>

        <pre className={clsx("text-[#8be9b4] whitespace-pre-wrap transition-opacity duration-300", showResponse ? "opacity-100" : "opacity-0")}>
          {RESPONSE.slice(0, chars)}
          {showResponse && chars < RESPONSE.length && (
            <span className="inline-block w-1.5 h-3 bg-[#8be9b4]/70 animate-pulse align-middle" />
          )}
        </pre>
      </div>
    </div>
  );
}
