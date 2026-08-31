"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

// The /resolve hero visual: one resolve call, looping, ALTERNATING between an
// EVM case and a Move-native Aptos case so both audiences see themselves.
//
// Shows the RESOLUTION OBJECT, which is what the endpoint actually returns and
// what every product renders. The old shape here (cause/error/fix) predated it,
// so this page was advertising a response we no longer give.
const EXAMPLES = [
  {
    request: `POST /api/v1/resolve
{ "tx": "0x8f2a4c…d41c" }`,
    work: ["fetch transaction", "replay at block 21044210", "decode revert", "establish custody"],
    response: `{
  "code": 5401,
  "category": "PROTOCOL_CONDITION",
  "status": "failed",
  "custody": "funds_with_user",
  "next_action_owner": "user",
  "retryable": "yes_after_change",
  "basis": "verified",
  "summary": "Price moved past the 0.3%
    tolerance while the swap was pending.",
  "evidence": [{ "kind": "revert",
    "value": "SlippageTooHigh" }]
}`,
  },
  {
    request: `POST /api/v1/resolve
{ "tx": "0x62505e…c110f" }`,
    work: ["fetch from Aptos fullnode", "read module ABI", "decode Move abort", "name the market"],
    response: `{
  "code": 7201,
  "category": "SETTLEMENT",
  "status": "failed",
  "custody": "funds_with_user",
  "next_action_owner": "none",
  "retryable": "no",
  "basis": "verified",
  "summary": "That ETH/USD order had already
    left the book, so there was nothing
    to amend.",
  "evidence": [{ "kind": "abort",
    "value": "EORDER_NOT_FOUND" }]
}`,
  },
];

type Phase = "request" | "work" | "respond" | "hold";

export function ApiCallMockup({ className }: { className?: string }) {
  const [example, setExample] = useState(0);
  const [phase, setPhase] = useState<Phase>("request");
  const [workStep, setWorkStep] = useState(0);
  const [chars, setChars] = useState(0);
  const [reduced, setReduced] = useState(false);

  const ex = EXAMPLES[example];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) {
      setPhase("hold");
      setWorkStep(EXAMPLES[0].work.length);
      setChars(EXAMPLES[0].response.length);
    }
  }, []);

  useEffect(() => {
    if (reduced) return;
    if (phase === "request") {
      const t = setTimeout(() => setPhase("work"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "work") {
      if (workStep >= ex.work.length) {
        const t = setTimeout(() => setPhase("respond"), 300);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setWorkStep(s => s + 1), 550);
      return () => clearTimeout(t);
    }
    if (phase === "respond") {
      if (chars >= ex.response.length) {
        const t = setTimeout(() => setPhase("hold"), 200);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setChars(c => Math.min(ex.response.length, c + 7)), 24);
      return () => clearTimeout(t);
    }
    // hold → swap example → loop
    const t = setTimeout(() => {
      setExample(e => (e + 1) % EXAMPLES.length);
      setWorkStep(0);
      setChars(0);
      setPhase("request");
    }, 5200);
    return () => clearTimeout(t);
  }, [phase, workStep, chars, reduced, ex]);

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
        <span className="ml-auto text-[10px] text-muted/50">{example === 0 ? "evm" : "aptos · move"}</span>
      </div>
      {/* FIXED height: the response types in over time, and a growing card
          shifts the hero text beside it on every loop. Sized to the tallest
          example so the layout never moves. */}
      <div className="p-4 space-y-3 h-[420px] overflow-hidden">
        <pre className="text-[#9aa0d8] whitespace-pre-wrap">{ex.request}</pre>

        <div className={clsx("space-y-1 transition-opacity duration-300", showWork ? "opacity-100" : "opacity-0")}>
          {ex.work.map((w, i) => (
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
          {ex.response.slice(0, chars)}
          {showResponse && chars < ex.response.length && (
            <span className="inline-block w-1.5 h-3 bg-[#8be9b4]/70 animate-pulse align-middle" />
          )}
        </pre>
      </div>
    </div>
  );
}
