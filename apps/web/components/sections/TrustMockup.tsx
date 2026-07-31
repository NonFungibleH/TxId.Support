"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";

// The Trust page header visual: a quiet verification loop. Three guarantees
// confirm themselves one at a time, then hold. Calm on purpose: nothing to
// prove, just checks passing.
const CHECKS = [
  { label: "Read-only access", detail: "no keys · no signing · no custody" },
  { label: "Answer verified", detail: "source: live on-chain read" },
  { label: "Case recorded", detail: "reviewable trail · every answer" },
];

export function TrustMockup({ className }: { className?: string }) {
  const [step, setStep] = useState(0); // 0..3, where 3 = all confirmed
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) setStep(CHECKS.length);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => setStep(s => (s >= CHECKS.length ? 0 : s + 1)),
      step >= CHECKS.length ? 4800 : 1100,
    );
    return () => clearTimeout(t);
  }, [step, reduced]);

  return (
    <div
      className={clsx(
        "w-full max-w-sm mx-auto rounded-2xl border border-[var(--border)] bg-[#0d0d18] shadow-2xl shadow-black/40 overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--border)] bg-[#10101d]">
        <div className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
        </div>
        <p className="text-[13px] font-semibold text-white">Every answer, checked</p>
      </div>
      <ul className="p-5 space-y-2.5">
        {CHECKS.map((c, i) => {
          const done = step > i;
          return (
            <li
              key={c.label}
              className={clsx(
                "flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-all duration-500",
                done ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-[var(--border)] bg-[#12121f]",
              )}
            >
              <CheckCircle2
                className={clsx(
                  "w-4 h-4 shrink-0 transition-colors duration-500",
                  done ? "text-emerald-400" : "text-muted/25",
                )}
              />
              <span className={clsx("text-sm transition-colors duration-500", done ? "text-white" : "text-muted/60")}>
                {c.label}
              </span>
              <span className="ml-auto text-[10px] font-mono text-muted/50">{c.detail}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
