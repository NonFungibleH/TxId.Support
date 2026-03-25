import { CheckCircle2, XCircle, Wifi } from "lucide-react";
import { clsx } from "clsx";

const TRANSACTIONS = [
  { status: "success", label: "Swap ETH → USDC", time: "2m ago" },
  { status: "success", label: "Approve USDC", time: "1h ago" },
  { status: "failed", label: "Failed swap", time: "3h ago" },
];

const TABS = ["Support", "Token", "Content"];

export function WidgetMockup({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "w-80 rounded-2xl overflow-hidden shadow-2xl shadow-accent/10",
        "border border-[var(--border)] bg-[#0c0c0c]",
        "font-sans text-sm",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
          <span className="font-display font-semibold text-white text-xs">
            TxID Support
          </span>
        </div>
        <Wifi className="w-3.5 h-3.5 text-muted" />
      </div>

      <div className="flex border-b border-[var(--border)]">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={clsx(
              "flex-1 py-2 text-xs transition-colors",
              i === 0
                ? "text-accent border-b-2 border-accent font-medium"
                : "text-muted hover:text-white"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
          <p className="text-white text-xs leading-relaxed">
            Hi 👋 I&apos;m your support agent. I can diagnose transactions and
            answer questions about the protocol.
          </p>
        </div>

        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="font-mono text-xs text-muted">0x1a2b...3c4d</span>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted px-1">Recent transactions</p>
          {TRANSACTIONS.map((tx, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-[var(--bg-elevated)] rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {tx.status === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                )}
                <span className="text-xs text-white">{tx.label}</span>
              </div>
              <span className="text-xs text-muted font-mono">{tx.time}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-elevated)] rounded-xl px-3 py-2 border border-[var(--border)]">
          <span className="text-xs text-muted flex-1">
            Ask anything about your wallet...
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
