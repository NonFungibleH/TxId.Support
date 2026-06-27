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
        "w-80 rounded-2xl overflow-hidden shadow-2xl shadow-accent/20",
        "bg-[#1e1e2e]",
        "font-sans text-sm",
        className
      )}
    >
      {/* Header + tabs unified — no separating borders */}
      <div className="bg-[#252540] px-4 pt-3 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
            <span className="font-display font-semibold text-white text-xs">
              TxID Support
            </span>
          </div>
          <Wifi className="w-3.5 h-3.5 text-white/25" />
        </div>

        <div className="flex">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={clsx(
                "flex-1 pb-2.5 text-xs transition-colors",
                i === 0
                  ? "text-accent border-b-2 border-accent font-medium"
                  : "text-white/30"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="bg-[#2a2a40] rounded-xl p-3">
          <p className="text-white/90 text-xs leading-relaxed">
            Hi 👋 I&apos;m your support agent. I can diagnose transactions and
            answer questions about the protocol.
          </p>
        </div>

        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="font-mono text-xs text-white/35">0x1a2b...3c4d</span>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-white/35 px-1">Recent transactions</p>
          {TRANSACTIONS.map((tx, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-[#2a2a40] rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {tx.status === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                )}
                <span className="text-xs text-white/80">{tx.label}</span>
              </div>
              <span className="text-xs text-white/30 font-mono">{tx.time}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[#2a2a40] rounded-xl px-3 py-2.5">
          <span className="text-xs text-white/30 flex-1">
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
