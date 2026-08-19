"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchCheck } from "lucide-react";

const TX_RE = /^0x[a-fA-F0-9]{64}$/;

/**
 * The show-not-tell moment in the hero: paste a real hash, get a real
 * diagnosis. Routes to /tx, which reads ?hash= and runs the check on arrival.
 */
export function HeroTxCheck() {
  const router = useRouter();
  const [hash, setHash] = useState("");
  const valid = TX_RE.test(hash.trim());

  function go() {
    if (!valid) return;
    router.push(`/tx?hash=${hash.trim()}`);
  }

  return (
    <div className="mt-6 w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1.5 pl-4 focus-within:border-[var(--border-accent)] transition-colors">
        <SearchCheck className="w-4 h-4 text-muted shrink-0" />
        <input
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Paste a failed transaction hash: 0x…"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent font-mono text-sm text-white outline-none placeholder:text-muted/60"
          aria-label="Transaction hash"
        />
        <button
          onClick={go}
          disabled={!valid}
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          Diagnose
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Free, no account. See exactly what your users would see.
      </p>
    </div>
  );
}
