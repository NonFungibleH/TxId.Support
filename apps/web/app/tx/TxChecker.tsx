"use client";

import { useState } from "react";
import {
  Search, Loader2, CheckCircle2, XCircle, Clock, HelpCircle,
  Copy, Check, ChevronDown, ArrowRight, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { APP_URL } from "@/lib/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support";

// diagnoseTransaction auto-detects across these, so "Auto-detect" is the honest
// default; naming one just makes the lookup a single call instead of a fan-out.
const CHAINS = [
  { id: "", name: "Auto-detect" },
  { id: "0x1", name: "Ethereum" },
  { id: "0x2105", name: "Base" },
  { id: "0x38", name: "BNB Chain" },
  { id: "0x89", name: "Polygon" },
  { id: "0xa4b1", name: "Arbitrum" },
  { id: "0xa", name: "Optimism" },
  { id: "0xa86a", name: "Avalanche" },
];

type Tone = "success" | "failed" | "pending" | "not_found";

interface Diagnosis {
  status: string;
  chain: string | null;
  chainId: string | null;
  cause: string | null;
  error: string | null;
  explanation: string;
  fix: string | null;
  method: string | null;
  gas: { verdict: string | null; effectiveGwei?: string };
  tokenTransfers: Array<{ symbol?: string; value: string; kind: string }>;
}

interface Result {
  hash: string;
  diagnosis: Diagnosis;
  verdict: { tone: Tone; headline: string; customerMessage: string };
}

const TONE: Record<Tone, { icon: typeof CheckCircle2; ring: string; text: string; chip: string; label: string }> = {
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-500/30",
    text: "text-emerald-400",
    chip: "bg-emerald-500/10 text-emerald-400",
    label: "Completed",
  },
  failed: {
    icon: XCircle,
    ring: "border-amber-500/30",
    text: "text-amber-400",
    chip: "bg-amber-500/10 text-amber-400",
    label: "Failed",
  },
  pending: {
    icon: Clock,
    ring: "border-sky-500/30",
    text: "text-sky-400",
    chip: "bg-sky-500/10 text-sky-400",
    label: "Pending",
  },
  not_found: {
    icon: HelpCircle,
    ring: "border-white/15",
    text: "text-muted",
    chip: "bg-white/5 text-muted",
    label: "Not found",
  },
};

const TX_RE = /^0x[0-9a-fA-F]{64}$/;

export function TxChecker() {
  const [hash, setHash] = useState("");
  const [chain, setChain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const valid = TX_RE.test(hash.trim());

  async function run() {
    const h = hash.trim();
    if (!TX_RE.test(h)) {
      setError("That doesn't look like a transaction hash. It should start with 0x and be 66 characters long.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setShowTech(false);
    try {
      const res = await fetch(`${API_URL}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: h, ...(chain ? { chain } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setResult(data as Result);
      }
    } catch {
      setError("Couldn't reach the checker. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.verdict.customerMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the text is still selectable on screen */
    }
  }

  const tone = result ? TONE[result.verdict.tone] : null;
  const ToneIcon = tone?.icon;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Input */}
      <div
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5"
      >
        <label htmlFor="tx-hash" className="sr-only">Transaction hash</label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 focus-within:border-[var(--border-accent)] transition-colors">
            <Search className="w-4 h-4 text-muted shrink-0" />
            <input
              id="tx-hash"
              value={hash}
              onChange={(e) => { setHash(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="Paste a transaction hash (0x…)"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-muted/60 font-mono"
            />
          </div>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            aria-label="Network"
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-sm text-white outline-none focus:border-[var(--border-accent)] transition-colors cursor-pointer"
          >
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id} className="bg-[var(--bg-elevated)]">
                {c.name}
              </option>
            ))}
          </select>
          <Button onClick={run} size="lg" className={loading || !valid ? "opacity-60 pointer-events-none" : ""}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
          </Button>
        </div>
        <p className="mt-2.5 px-1 text-xs text-muted">
          Free, no account. Reads public chain data across seven EVM networks.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Result */}
      {result && tone && ToneIcon && (
        <div className={`mt-5 rounded-2xl border ${tone.ring} bg-[var(--bg-surface)] overflow-hidden`}>
          {/* Verdict header */}
          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-3.5">
              <ToneIcon className={`w-6 h-6 shrink-0 mt-0.5 ${tone.text}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                  <span className={`text-[11px] font-mono uppercase tracking-widest rounded-full px-2 py-0.5 ${tone.chip}`}>
                    {tone.label}
                  </span>
                  {result.diagnosis.chain && (
                    <span className="text-[11px] text-muted">{result.diagnosis.chain}</span>
                  )}
                </div>
                <p className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
                  {result.verdict.headline}
                </p>
              </div>
            </div>

            {/* What to do next */}
            {result.diagnosis.fix && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                <span className="text-[11px] font-mono uppercase tracking-widest text-accent mt-0.5 shrink-0">Next</span>
                <p className="text-sm text-white/90 leading-relaxed">{result.diagnosis.fix}</p>
              </div>
            )}
          </div>

          {/* Customer-ready message — the thing a block explorer never gives */}
          <div className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/40 p-6 sm:p-7">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted">
                Message to send the customer
              </p>
              <button
                onClick={copyMessage}
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-sm text-white/90 leading-relaxed rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              {result.verdict.customerMessage}
            </p>
          </div>

          {/* Technical details, collapsed — power users only, never the headline */}
          <div className="border-t border-[var(--border)]">
            <button
              onClick={() => setShowTech((v) => !v)}
              className="w-full flex items-center justify-between px-6 sm:px-7 py-3.5 text-xs text-muted hover:text-white transition-colors"
            >
              <span>Technical details</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showTech ? "rotate-180" : ""}`} />
            </button>
            {showTech && (
              <dl className="px-6 sm:px-7 pb-5 space-y-2 text-xs">
                <Row label="Status" value={result.diagnosis.status} />
                {result.diagnosis.method && <Row label="Method" value={result.diagnosis.method} mono />}
                {result.diagnosis.cause && result.diagnosis.cause !== "success" && (
                  <Row label="Cause" value={result.diagnosis.cause} mono />
                )}
                {result.diagnosis.error && <Row label="Error" value={result.diagnosis.error} mono />}
                {result.diagnosis.gas.verdict && <Row label="Gas" value={result.diagnosis.gas.verdict} />}
                {result.diagnosis.tokenTransfers.length > 0 && (
                  <Row
                    label="Transfers"
                    value={result.diagnosis.tokenTransfers
                      .map((t) => `${t.value}${t.symbol ? ` ${t.symbol}` : ""}`)
                      .join(", ")}
                  />
                )}
                <Row label="Hash" value={result.hash} mono />
              </dl>
            )}
          </div>

          {/* Provenance — the evidence DNA, for free */}
          {result.diagnosis.chain && (
            <div className="flex items-center gap-2 border-t border-[var(--border)] px-6 sm:px-7 py-3 text-[11px] text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-accent/70" />
              Read live from {result.diagnosis.chain}. No account, nothing stored.
            </div>
          )}
        </div>
      )}

      {/* Exits — only after a result, so they never pre-empt the tool */}
      {result && (
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <a
            href={`${APP_URL}/sign-up`}
            className="group rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-accent)]"
          >
            <p className="text-sm font-semibold text-white flex items-center justify-between">
              Run a protocol?
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Your own users could get this answer inside your app, on your brand.
            </p>
          </a>
          <a
            href="/api"
            className="group rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-accent)]"
          >
            <p className="text-sm font-semibold text-white flex items-center justify-between">
              Checking in bulk?
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              The same diagnosis as one API call, for your product or dashboards.
            </p>
          </a>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className={`text-white/80 text-right break-all ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd>
    </div>
  );
}
