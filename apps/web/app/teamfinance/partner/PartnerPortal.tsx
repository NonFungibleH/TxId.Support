"use client";

import { useState } from "react";

// Demo affiliate/referral portal for Team Finance. All data below is fabricated
// sample data. Inline-styled to match the Team Finance pitch page (blue, Inter,
// flat, all-light). Copy rule: no em dashes.

const BLUE = "#1863DC";
const BLUE_HOVER = "#0F4CAF";
const BLUE_TINT = "#EAF1FC";
const INK = "#101223";
const BODY = "#4B5063";
const MUTE = "#9AA0B4";
const LINE = "#EDEFF6";
const PANEL = "#F7F8FC";
const GOOD = "#22A06B";
const WARN = "#C0842B";
const BAD = "#D5463A";

const RATE = 0.2; // 20% revenue share

type Status = "active" | "trialing" | "churned";
type Invoice = "paid" | "due" | "overdue" | "none";
type Plan = "Starter" | "Growth" | "Scale";

type Client = {
  name: string;
  symbol: string;
  plan: Plan;
  mrr: number; // what the client pays TxID per month
  chains: number;
  resUsed: number;
  resIncl: number;
  status: Status;
  joined: string;
  invoice: Invoice;
};

const CLIENTS: Client[] = [
  { name: "Aster Protocol", symbol: "ASTR", plan: "Growth", mrr: 898, chains: 2, resUsed: 1640, resIncl: 2000, status: "active", joined: "Feb 2026", invoice: "paid" },
  { name: "NovaDAO", symbol: "NOVA", plan: "Scale", mrr: 1999, chains: 4, resUsed: 4820, resIncl: 6000, status: "active", joined: "Jan 2026", invoice: "paid" },
  { name: "Pulsr", symbol: "PLS", plan: "Growth", mrr: 799, chains: 1, resUsed: 1180, resIncl: 2000, status: "active", joined: "Mar 2026", invoice: "paid" },
  { name: "Zenith Finance", symbol: "ZEN", plan: "Starter", mrr: 299, chains: 1, resUsed: 410, resIncl: 500, status: "active", joined: "Apr 2026", invoice: "paid" },
  { name: "Kairos", symbol: "KAI", plan: "Growth", mrr: 997, chains: 3, resUsed: 1780, resIncl: 2000, status: "active", joined: "Feb 2026", invoice: "paid" },
  { name: "Orbital", symbol: "ORB", plan: "Scale", mrr: 1999, chains: 3, resUsed: 3550, resIncl: 6000, status: "active", joined: "Jan 2026", invoice: "paid" },
  { name: "Fathom", symbol: "FTHM", plan: "Growth", mrr: 799, chains: 1, resUsed: 1290, resIncl: 2000, status: "active", joined: "Mar 2026", invoice: "paid" },
  { name: "Meridian", symbol: "MRD", plan: "Starter", mrr: 299, chains: 1, resUsed: 300, resIncl: 500, status: "active", joined: "Jul 2026", invoice: "paid" },
  { name: "Vertex", symbol: "VTX", plan: "Growth", mrr: 799, chains: 2, resUsed: 960, resIncl: 2000, status: "active", joined: "May 2026", invoice: "paid" },
  { name: "Halcyon", symbol: "HLC", plan: "Growth", mrr: 799, chains: 1, resUsed: 640, resIncl: 2000, status: "active", joined: "Aug 2026", invoice: "paid" },
  { name: "Solstice", symbol: "SOL", plan: "Starter", mrr: 299, chains: 1, resUsed: 260, resIncl: 500, status: "active", joined: "Dec 2025", invoice: "paid" },
  { name: "Lumen", symbol: "LMN", plan: "Starter", mrr: 0, chains: 1, resUsed: 120, resIncl: 500, status: "trialing", joined: "Aug 2026", invoice: "none" },
];

const billing = CLIENTS.filter((c) => c.status === "active");
const combinedMRR = billing.reduce((s, c) => s + c.mrr, 0);
const commission = Math.round(combinedMRR * RATE);
const pendingPayout = commission; // every client invoice is paid and up to date
const annualRunRate = commission * 12; // projected yearly commission at today's MRR
const LIFETIME = 24980;

const activeCount = billing.length;
const trialingCount = CLIENTS.filter((c) => c.status === "trialing").length;
const topClients = [...billing].sort((a, b) => b.mrr - a.mrr).slice(0, 4);

const SERIES = [
  { m: "Mar", v: 1120 },
  { m: "Apr", v: 1290 },
  { m: "May", v: 1460 },
  { m: "Jun", v: 1650 },
  { m: "Jul", v: 1810 },
  { m: "Aug", v: commission },
];
const SERIES_MAX = Math.max(...SERIES.map((s) => s.v));

const PAYOUTS = [
  { period: "Aug 2026", amount: pendingPayout, status: "Scheduled", date: "Sep 1, 2026" },
  { period: "Jul 2026", amount: 1810, status: "Paid", date: "Aug 1, 2026" },
  { period: "Jun 2026", amount: 1650, status: "Paid", date: "Jul 1, 2026" },
  { period: "May 2026", amount: 1460, status: "Paid", date: "Jun 1, 2026" },
  { period: "Apr 2026", amount: 1290, status: "Paid", date: "May 1, 2026" },
];

const ACTIVITY: { date: string; text: string; tone: "good" | "warn" | "bad" | "flat" }[] = [
  { date: "Aug 6", text: "Orbital upgraded from Growth to Scale, lifting your revenue split.", tone: "good" },
  { date: "Aug 2", text: "Halcyon completed onboarding and went live.", tone: "good" },
  { date: "Jul 28", text: "Kairos added Arbitrum as a second chain.", tone: "good" },
  { date: "Jul 21", text: "Meridian signed up on the Starter plan.", tone: "good" },
  { date: "Jul 14", text: "Vertex renewed for another 12 months.", tone: "good" },
  { date: "Jul 6", text: "NovaDAO resolved over 4,800 holder questions this month.", tone: "good" },
];

const usd = (n: number) => "$" + n.toLocaleString("en-US");
const toneColor = (t: string) => (t === "good" ? GOOD : t === "warn" ? WARN : t === "bad" ? BAD : MUTE);

function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "flat" | "blue"; children: React.ReactNode }) {
  const map = {
    good: { c: GOOD, bg: "#E7F6EF" },
    warn: { c: WARN, bg: "#FBF2E1" },
    bad: { c: BAD, bg: "#FBE9E7" },
    flat: { c: "#6C7085", bg: "#EEF0F5" },
    blue: { c: BLUE, bg: BLUE_TINT },
  }[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: map.c, background: map.bg, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: map.c, flex: "none" }} />
      {children}
    </span>
  );
}

function statusPill(s: Status) {
  if (s === "active") return <Pill tone="good">Active</Pill>;
  if (s === "trialing") return <Pill tone="blue">Trialing</Pill>;
  return <Pill tone="flat">Churned</Pill>;
}
function invoicePill(i: Invoice) {
  if (i === "paid") return <Pill tone="good">Paid</Pill>;
  if (i === "due") return <Pill tone="warn">Due</Pill>;
  if (i === "overdue") return <Pill tone="bad">Overdue</Pill>;
  return <span style={{ color: MUTE, fontSize: 13 }}>—</span>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 22, boxShadow: "0 1px 2px rgba(16,18,35,0.04)", ...style }}>{children}</div>;
}

function Kpi({ label, value, delta, sub, subTone }: { label: string; value: string; delta?: string; sub?: string; subTone?: "good" | "warn" | "bad" | "flat" }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: MUTE, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 27, fontWeight: 700, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {delta && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: GOOD, background: "#E7F6EF", borderRadius: 6, padding: "2px 7px", fontVariantNumeric: "tabular-nums" }}>{delta}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: toneColor(subTone ?? "flat"), marginTop: 5, fontWeight: 500 }}>{sub}</div>}
    </Card>
  );
}

export function PartnerPortal() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"overview" | "clients" | "payouts">("overview");

  if (!authed) return <Login onSignIn={() => setAuthed(true)} />;

  return (
    <div className="pp" style={{ minHeight: "100vh", background: PANEL, fontFamily: "var(--font-inter), system-ui, sans-serif", color: INK, WebkitFontSmoothing: "antialiased" }}>
      <style>{`
        .pp tbody tr { transition: background .12s ease; }
        .pp tbody tr:hover { background: #FAFBFE; }
        .pp .pp-signout:hover { background: #F4F6FB; border-color: #C9D0E0; }
        .pp .pp-tab:hover { color: ${INK}; }
      `}</style>
      {/* Top bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "13px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <Lockup />
          <span style={{ marginLeft: 6, paddingLeft: 14, borderLeft: `1px solid ${LINE}`, fontSize: 13.5, fontWeight: 600, color: BODY }}>Partner Portal</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Pill tone="blue">Sample data</Pill>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: BLUE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>TF</span>
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>Team Finance</span>
                <span style={{ fontSize: 11.5, color: MUTE }}>partner@team.finance</span>
              </span>
            </span>
            <button onClick={() => setAuthed(false)} className="pp-signout" style={{ fontSize: 13.5, fontWeight: 600, color: INK, background: "#fff", border: `1px solid #DCE0EC`, borderRadius: 8, padding: "7px 13px", cursor: "pointer", transition: "background .12s ease, border-color .12s ease" }}>
              Sign out
            </button>
          </span>
        </div>
        {/* Tabs */}
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 24px", display: "flex", gap: 4 }}>
          {([["overview", "Overview"], ["clients", "Referred clients"], ["payouts", "Payouts"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="pp-tab"
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: "12px 12px 14px", fontSize: 14, fontWeight: 600, color: tab === k ? BLUE : BODY, transition: "color .12s ease" }}
            >
              {label}
              {tab === k && <span style={{ position: "absolute", left: 12, right: 12, bottom: 0, height: 2, background: BLUE, borderRadius: 2 }} />}
            </button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 24px 80px" }}>
        {tab === "overview" && <Overview />}
        {tab === "clients" && <Clients />}
        {tab === "payouts" && <Payouts />}
      </main>
    </div>
  );
}

function Overview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Welcome back, Team Finance</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: BODY }}>
          Your referred projects and the revenue split they earn you. You are on a {Math.round(RATE * 100)}% revenue split.
        </p>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: 14 }}>
        <Kpi label="Referred clients" value={String(CLIENTS.length)} delta="+2" sub={`${activeCount} active, ${trialingCount} trialing`} subTone="flat" />
        <Kpi label="Combined client MRR" value={usd(combinedMRR)} delta="▲ 8.1%" sub="across active projects" subTone="flat" />
        <Kpi label="Your revenue split / mo" value={usd(commission)} delta="▲ 10.4%" sub={`${Math.round(RATE * 100)}% of active MRR`} subTone="good" />
        <Kpi label="Projected annual" value={usd(annualRunRate)} sub="at current run rate" subTone="good" />
        <Kpi label="Pending payout" value={usd(pendingPayout)} sub="all invoices up to date" subTone="good" />
        <Kpi label="Lifetime earned" value={usd(LIFETIME)} sub="since Dec 2025" subTone="flat" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18, alignItems: "start" }} className="pp-two">
        {/* Revenue split trend */}
        <Card>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Revenue split earned</div>
            <div style={{ fontSize: 12.5, color: MUTE }}>Last 6 months</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, marginTop: 20, paddingBottom: 4 }}>
            {SERIES.map((s, i) => {
              const h = Math.round((s.v / SERIES_MAX) * 132) + 6;
              const last = i === SERIES.length - 1;
              return (
                <div key={s.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: last ? BLUE : MUTE, fontVariantNumeric: "tabular-nums" }}>{usd(s.v)}</div>
                  <div style={{ width: "100%", maxWidth: 46, height: h, borderRadius: 7, background: last ? BLUE : "#CBD9F3" }} />
                  <div style={{ fontSize: 12, color: BODY }}>{s.m}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: BODY }}>
              On track for <b style={{ color: INK }}>{usd(annualRunRate)}</b> over the next 12 months at today&apos;s run rate.
            </span>
            <span style={{ fontSize: 12.5, color: MUTE }}>Every new project you refer adds to it.</span>
          </div>
        </Card>

        {/* Top clients */}
        <Card>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Top clients</div>
          <p style={{ margin: "3px 0 14px", fontSize: 12.5, color: BODY }}>Your highest-earning referrals this month.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topClients.map((c) => (
              <div key={c.symbol} style={{ display: "flex", alignItems: "center", gap: 12, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 13px" }}>
                <Avatar symbol={c.symbol} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: BODY }}>{c.plan} · {usd(c.mrr)} / mo</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 700, color: GOOD, fontVariantNumeric: "tabular-nums" }}>+{usd(Math.round(c.mrr * RATE))}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Recent activity</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {ACTIVITY.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE}` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: toneColor(a.tone), flex: "none", marginTop: 6 }} />
              <span style={{ fontSize: 13.5, color: INK, flex: 1 }}>{a.text}</span>
              <span style={{ fontSize: 12.5, color: MUTE, flex: "none" }}>{a.date}</span>
            </div>
          ))}
        </div>
      </Card>

      <Disclaimer />
      <style>{`@media (max-width: 820px){ .pp-two{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function Clients() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Referred clients</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: BODY }}>Every project you have referred, their plan, usage and what they earn you.</p>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: PANEL }}>
                {["Client", "Plan", "Status", "Resolutions used", "Chains", "Client MRR", `Your ${Math.round(RATE * 100)}%`, "Invoice", "Joined"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 4 && i <= 6 ? "right" : "left", fontSize: 11.5, fontWeight: 700, color: MUTE, letterSpacing: "0.03em", textTransform: "uppercase", padding: "12px 16px", borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLIENTS.map((c) => {
                const pct = Math.min(100, Math.round((c.resUsed / c.resIncl) * 100));
                const over = c.resUsed > c.resIncl;
                return (
                  <tr key={c.symbol} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <Avatar symbol={c.symbol} />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 11.5, color: MUTE }}>{c.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13.5, color: BODY }}>{c.plan}</td>
                    <td style={{ padding: "13px 16px" }}>{statusPill(c.status)}</td>
                    <td style={{ padding: "13px 16px", minWidth: 180 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: over ? BAD : BODY, marginBottom: 5, fontVariantNumeric: "tabular-nums" }}>
                        <span>{c.resUsed.toLocaleString()} / {c.resIncl.toLocaleString()}</span>
                        {over && <span style={{ fontWeight: 600 }}>overage</span>}
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "#E7EAF1", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: over ? BAD : BLUE }} />
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13.5, color: BODY, fontVariantNumeric: "tabular-nums" }}>{c.chains}</td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{c.mrr ? usd(c.mrr) : "—"}</td>
                    <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13.5, fontWeight: 700, color: c.mrr ? GOOD : MUTE, fontVariantNumeric: "tabular-nums" }}>{c.mrr ? usd(Math.round(c.mrr * RATE)) : "—"}</td>
                    <td style={{ padding: "13px 16px" }}>{invoicePill(c.invoice)}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: BODY, whiteSpace: "nowrap" }}>{c.joined}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: PANEL }}>
                <td colSpan={5} style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: BODY }}>{activeCount} active projects</td>
                <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{usd(combinedMRR)}</td>
                <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13.5, fontWeight: 700, color: GOOD, fontVariantNumeric: "tabular-nums" }}>{usd(commission)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <Disclaimer />
    </div>
  );
}

function Payouts() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Payouts</h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: BODY }}>Your revenue split is paid monthly, straight to your wallet on the 1st.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="pp-two">
        <Card style={{ background: BLUE, border: "none", color: "#fff" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#CFE0FA" }}>Next payout</div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{usd(pendingPayout)}</div>
          <div style={{ fontSize: 13.5, color: "#DCE8FB", marginTop: 4 }}>Scheduled for Sep 1, 2026 · about {usd(annualRunRate)} a year at this run rate</div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.18)", fontSize: 13, color: "#DCE8FB" }}>
            All {activeCount} client invoices are paid and up to date, so your full revenue split is on its way.
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Payout method</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            <Row label="Method" value="USDC on Base" />
            <Row label="Wallet" value="0x8F2c…4Ae1" mono />
            <Row label="Schedule" value="Monthly, 1st" />
            <Row label="Revenue split" value={`${Math.round(RATE * 100)}%`} />
            <Row label="Tax form" value="W-8BEN-E on file" />
          </div>
        </Card>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", fontSize: 15, fontWeight: 700 }}>Payout history</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ background: PANEL }}>
                {["Period", "Amount", "Status", "Date"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 1 ? "right" : "left", fontSize: 11.5, fontWeight: 700, color: MUTE, letterSpacing: "0.03em", textTransform: "uppercase", padding: "11px 22px", borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PAYOUTS.map((p) => (
                <tr key={p.period} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <td style={{ padding: "13px 22px", fontSize: 13.5, fontWeight: 600 }}>{p.period}</td>
                  <td style={{ padding: "13px 22px", textAlign: "right", fontSize: 13.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{usd(p.amount)}</td>
                  <td style={{ padding: "13px 22px" }}>{p.status === "Paid" ? <Pill tone="good">Paid</Pill> : <Pill tone="blue">Scheduled</Pill>}</td>
                  <td style={{ padding: "13px 22px", fontSize: 13, color: BODY }}>{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Disclaimer />
      <style>{`@media (max-width: 820px){ .pp-two{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 13.5, color: BODY }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: INK, fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined }}>{value}</span>
    </div>
  );
}

function Avatar({ symbol }: { symbol: string }) {
  const letter = symbol.slice(0, 1);
  return (
    <div style={{ width: 34, height: 34, borderRadius: 9, background: BLUE_TINT, color: BLUE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flex: "none" }}>
      {letter}
    </div>
  );
}

function Disclaimer() {
  return (
    <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTE, textAlign: "center" }}>
      Demo environment. All clients, figures and payouts on this page are sample data for illustration.
    </p>
  );
}

function Lockup() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: BLUE }}>Team Finance</span>
      <span style={{ width: 1, height: 16, background: "#D2D8E5" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 18, height: 18, borderRadius: 5, background: BLUE, display: "block" }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: INK }}>TxID</span>
      </div>
    </div>
  );
}

function Login({ onSignIn }: { onSignIn: () => void }) {
  const [email, setEmail] = useState("partner@team.finance");
  const [pw, setPw] = useState("demo-access");

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#F7F8FC 0%,#EAF1FC 100%)", fontFamily: "var(--font-inter), system-ui, sans-serif", color: INK, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, WebkitFontSmoothing: "antialiased" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}><Lockup /></div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSignIn(); }}
          style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 30, boxShadow: "0 26px 60px -30px rgba(16,18,35,0.30)" }}
        >
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>Partner Portal</h1>
          <p style={{ margin: "5px 0 22px", fontSize: 13.5, color: BODY }}>Sign in to see your referred clients and payouts.</p>

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: BODY, marginBottom: 6 }}>Work email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: BODY, margin: "16px 0 6px" }}>Password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={inputStyle} />

          <button type="submit" className="pp-signin" style={{ width: "100%", marginTop: 22, background: BLUE, color: "#fff", fontSize: 15, fontWeight: 600, padding: "13px", borderRadius: 9, border: "none", cursor: "pointer" }}>
            Sign in
          </button>
          <p style={{ margin: "16px 0 0", fontSize: 12, color: MUTE, textAlign: "center" }}>Demo access. Any credentials sign you in.</p>
        </form>
        <p style={{ margin: "18px 0 0", fontSize: 12, color: MUTE, textAlign: "center" }}>Team Finance affiliate program · Powered by TxID</p>
      </div>
      <style>{`.pp-signin:hover{background:${BLUE_HOVER}}`}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: 14,
  color: INK,
  background: "#fff",
  border: `1px solid #DCE0EC`,
  borderRadius: 9,
  padding: "11px 13px",
  outline: "none",
};
