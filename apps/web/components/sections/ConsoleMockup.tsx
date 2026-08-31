/**
 * The /console hero: a support desk, not a diagram.
 *
 * The Console is the one product a buyer pictures as software they log into, so
 * the graphic has to look like the tool their team would open on Monday: a
 * queue on the left, the case they picked on the right. Familiar on purpose.
 *
 * Every case is a real failure class we decode, and the Aptos row is the
 * transaction from our own Decibel testing, so nothing here is invented.
 *
 * CSS only, no client JS: it never needs to react, so it should not hydrate.
 */
const NAV = [
  { label: "Queue", badge: "12", active: true },
  { label: "Cases", badge: null, active: false },
  { label: "Team", badge: null, active: false },
  { label: "Audit", badge: null, active: false },
]

type Row = {
  ref: string
  who: string
  issue: string
  chain: string
  state: "open" | "resolved" | "waiting"
  active?: boolean
}

const ROWS: Row[] = [
  { ref: "TX-4102", who: "0x8cf0…acca", issue: "Order update did not apply", chain: "Aptos", state: "open", active: true },
  { ref: "TX-4101", who: "0x0446…e633", issue: "Swap reverted on submit", chain: "BNB", state: "waiting" },
  { ref: "TX-4098", who: "0x91ab…77c2", issue: "Transfer never arrived", chain: "Base", state: "resolved" },
  { ref: "TX-4095", who: "0x33de…10ff", issue: "Withdrawal still pending", chain: "Arbitrum", state: "resolved" },
]

const STATE_STYLE: Record<Row["state"], string> = {
  open: "text-[var(--yellow)] bg-[color-mix(in_srgb,var(--yellow)_14%,transparent)]",
  waiting: "text-muted bg-[var(--bg-elevated)]",
  resolved: "text-teal bg-[color-mix(in_srgb,var(--teal)_14%,transparent)]",
}

const DETAIL = [
  { k: "category", v: "SETTLEMENT" },
  { k: "status", v: "failed" },
  { k: "custody", v: "funds with user" },
  { k: "next action", v: "no action needed" },
]

export function ConsoleMockup({ className }: { className?: string }) {
  return (
    <div
      className={[
        "rounded-xl border border-[var(--border)] bg-deep overflow-hidden shadow-2xl",
        className ?? "",
      ].join(" ")}
    >
      {/* Window chrome: the cheapest possible signal that this is an app. */}
      <div className="flex items-center gap-2 px-4 h-9 border-b border-[var(--border)] bg-surface">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-subtle)]/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-subtle)]/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-subtle)]/40" />
        <span className="ml-3 font-mono text-[10px] text-subtle">TxID Console</span>
      </div>

      <div className="grid grid-cols-[104px_1fr] sm:grid-cols-[128px_1fr]">
        {/* Sidebar */}
        <div className="border-r border-[var(--border)] bg-surface/60 py-3">
          {NAV.map(({ label, badge, active }) => (
            <div
              key={label}
              className={[
                "flex items-center justify-between mx-2 px-2.5 py-2 rounded-lg text-xs",
                active ? "bg-accent-muted text-white font-semibold" : "text-muted",
              ].join(" ")}
            >
              <span>{label}</span>
              {badge && (
                <span className="font-mono text-[10px] text-accent">{badge}</span>
              )}
            </div>
          ))}
        </div>

        {/* Queue + the selected case */}
        <div>
          <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Failed transactions</span>
            <span className="font-mono text-[10px] text-subtle">4 of 12</span>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {ROWS.map((r) => (
              <div
                key={r.ref}
                className={[
                  "px-4 py-2.5 grid grid-cols-[auto_1fr_auto] items-center gap-3",
                  r.active ? "bg-elevated" : "",
                ].join(" ")}
              >
                <span className="font-mono text-[10px] text-subtle w-14">{r.ref}</span>
                <span className="min-w-0">
                  <span className="block text-xs text-white truncate">{r.issue}</span>
                  <span className="block font-mono text-[10px] text-subtle truncate">
                    {r.who} · {r.chain}
                  </span>
                </span>
                <span
                  className={[
                    "font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                    STATE_STYLE[r.state],
                  ].join(" ")}
                >
                  {r.state}
                </span>
              </div>
            ))}
          </div>

          {/* The answer, for the row the agent has open. */}
          <div className="border-t border-[var(--border-accent)] bg-elevated px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-mono text-[10px] text-muted tracking-widest">RESOLUTION</span>
              <span className="font-mono text-[10px] text-accent bg-accent-muted px-1.5 py-0.5 rounded">
                7201
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {DETAIL.map(({ k, v }) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] text-subtle">{k}</span>
                  <span className="text-[11px] text-white font-medium truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" aria-hidden="true">
                <circle cx="8" cy="8" r="7" fill="none" stroke="var(--teal)" strokeWidth="1.4" />
                <path d="M4.5 8.2 L7 10.6 L11.5 5.6" fill="none" stroke="var(--teal)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] text-muted">
                Evidence attached · read at ledger 6938092558
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
