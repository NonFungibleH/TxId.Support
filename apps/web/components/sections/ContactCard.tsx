"use client";

import { useState } from "react";
import { Copy, Check, Mail, Send } from "lucide-react";

const EMAIL = "team@txid.support";
const TELEGRAM = "https://t.me/Non_Fungible_Howard";

export function ContactCard() {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (rare) — the address is visible to select manually.
    }
  }

  return (
    <div className="space-y-4">
      {/* Email — copyable, never depends on a mail client */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-white">Email us</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <code className="flex-1 font-mono text-sm text-white bg-black/30 rounded-lg px-4 py-3 select-all break-all">
            {EMAIL}
          </code>
          <button
            onClick={copyEmail}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <a
          href={`mailto:${EMAIL}`}
          className="inline-block mt-3 text-xs text-muted hover:text-white transition-colors"
        >
          Or open your mail app →
        </a>
      </div>

      {/* Telegram — most reliable for a crypto-native audience */}
      <a
        href={TELEGRAM}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-accent" />
          <div>
            <p className="text-sm font-medium text-white">Message on Telegram</p>
            <p className="text-xs text-muted">@Non_Fungible_Howard · usually fastest</p>
          </div>
        </div>
        <span className="text-muted group-hover:text-white transition-colors">→</span>
      </a>
    </div>
  );
}
