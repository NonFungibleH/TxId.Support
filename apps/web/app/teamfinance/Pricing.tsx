"use client";

import { useState } from "react";

// Team Finance pitch page ONLY. Inline-styled to match the page (Team Finance
// blue, Inter, flat, all-light). Numbers approved 2026-08-13. A resolution is
// one conversation, capped at 10 messages, answered or escalated: exactly what
// the billing meter counts. Copy rule: "custom branded", no em dashes.

const BLUE = "#1863DC";
const BLUE_HOVER = "#0F4CAF";
const BLUE_TINT = "#EAF1FC";
const INK = "#101223";
const BODY = "#4B5063";
const LINE = "#EDEFF6";

// Every plan covers one chain; extra chains are a flat add-on. Suggested figure.
const PER_CHAIN = "$99";

type Tier = {
  name: string;
  monthly: number;
  resolutions: string;
  overage: string;
  tagline: string;
  features: string[];
  popular?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    monthly: 299,
    resolutions: "500",
    overage: "$0.99",
    tagline: "For a single token getting started.",
    features: [
      "Website widget",
      "Docs Q&A and transaction investigation",
      "The Case Record on every answer",
      "Email support",
    ],
  },
  {
    name: "Growth",
    monthly: 799,
    resolutions: "2,000",
    overage: "$0.79",
    tagline: "Everything a live project needs.",
    popular: true,
    features: [
      "Everything in Starter, plus:",
      "Widget, Telegram and API",
      "Slack, Discord, Linear, GitHub and Jira",
      "Full Case Record with export",
      "Bug reports and feedback tools",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    monthly: 1999,
    resolutions: "6,000",
    overage: "$0.59",
    tagline: "For high volume and compliance.",
    features: [
      "Everything in Growth, plus:",
      "SSO",
      "Uptime SLA",
      "Dedicated support",
      "Hands-on onboarding",
    ],
  },
];

function contactHref(tier: string) {
  const subject = encodeURIComponent(`TxID × Team Finance: ${tier} plan`);
  const body = encodeURIComponent(
    `Hi TxID team, we came from Team Finance and would like to get started on the ${tier} plan. Our token is:`,
  );
  return `mailto:team@txid.support?subject=${subject}&body=${body}`;
}

const annualMonthly = (m: number) => Math.round((m * 10) / 12);

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}>
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      {/* Billing toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 36, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: annual ? "#9AA0B4" : INK }}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Toggle annual billing"
          onClick={() => setAnnual((a) => !a)}
          style={{ position: "relative", height: 24, width: 44, borderRadius: 999, border: "none", cursor: "pointer", padding: 0, background: annual ? BLUE : "#CBD2E0", transition: "background 0.15s" }}
        >
          <span style={{ position: "absolute", top: 2, left: annual ? 22 : 2, height: 20, width: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.15s" }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: annual ? INK : "#9AA0B4" }}>Annual</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: BLUE, background: BLUE_TINT, borderRadius: 999, padding: "3px 10px" }}>2 months free</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,270px),1fr))", gap: 20, maxWidth: 920, margin: "0 auto", alignItems: "start" }}>
        {TIERS.map((tier) => {
          const price = annual ? annualMonthly(tier.monthly) : tier.monthly;
          return (
            <div
              key={tier.name}
              className="tf-card"
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: "#fff",
                borderRadius: 16,
                padding: 28,
                border: tier.popular ? `2px solid ${BLUE}` : "1px solid #E6E9F2",
                boxShadow: tier.popular ? "0 20px 44px -22px rgba(24,99,220,0.4)" : "0 1px 2px rgba(16,18,35,0.04)",
              }}
            >
              {tier.popular && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: BLUE, color: "#fff", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.03em", padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>
                  Most popular
                </div>
              )}

              <div style={{ fontSize: 19, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>{tier.name}</div>
              <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.5, color: BODY }}>{tier.tagline}</p>

              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 18 }}>
                <span style={{ fontSize: 38, fontWeight: 700, color: INK, letterSpacing: "-0.02em" }}>${price.toLocaleString()}</span>
                <span style={{ fontSize: 14, color: BODY }}>/mo</span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#9AA0B4", minHeight: 16 }}>
                {annual ? `$${(price * 12).toLocaleString()} billed yearly` : "billed monthly"}
              </p>

              <div style={{ marginTop: 18, background: "#F7F8FC", border: `1px solid ${LINE}`, borderRadius: 12, padding: 15 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: INK }}>
                  <b>{tier.resolutions}</b> resolutions included
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: BODY }}>then {tier.overage} per resolution</p>
                <p style={{ margin: "10px 0 0", paddingTop: 10, borderTop: `1px solid ${LINE}`, fontSize: 13.5, color: INK }}>
                  <b>1 chain</b> included
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: BODY }}>add more from {PER_CHAIN}/mo each</p>
              </div>

              <a
                href={contactHref(tier.name)}
                className={tier.popular ? "tf-btn" : "tf-btn-outline"}
                style={
                  tier.popular
                    ? { marginTop: 20, display: "inline-flex", justifyContent: "center", background: BLUE, color: "#fff", fontSize: 14.5, fontWeight: 600, padding: "12px 18px", borderRadius: 9 }
                    : { marginTop: 20, display: "inline-flex", justifyContent: "center", border: "1px solid #DCE0EC", color: INK, fontSize: 14.5, fontWeight: 600, padding: "12px 18px", borderRadius: 9 }
                }
              >
                Get started
              </a>

              <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
                {tier.features.map((f) => {
                  const header = f.startsWith("Everything in");
                  return (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: header ? INK : "#33374D", fontWeight: header ? 600 : 400, paddingTop: header ? 2 : 0 }}>
                      {!header && <Check />}
                      <span>{f}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Enterprise */}
      <div style={{ maxWidth: 920, margin: "20px auto 0", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, background: "#F7F8FC", border: `1px solid ${LINE}`, borderRadius: 14, padding: "20px 24px" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: INK }}>Enterprise</div>
          <p style={{ margin: "3px 0 0", fontSize: 13.5, color: BODY }}>Unlimited volume, white-label, custom SLA and security review.</p>
        </div>
        <a href={contactHref("Enterprise")} className="tf-btn-outline" style={{ flex: "none", border: "1px solid #DCE0EC", color: INK, fontSize: 14, fontWeight: 600, padding: "11px 20px", borderRadius: 9 }}>
          Talk to us
        </a>
      </div>

      <p style={{ maxWidth: 620, margin: "22px auto 0", textAlign: "center", fontSize: 12.5, lineHeight: 1.6, color: "#9AA0B4" }}>
        A resolution is one support conversation, from the holder&apos;s first message until it ends: the agent
        answers it, or it is escalated to your team. Each plan covers one chain; add more from {PER_CHAIN}/mo each.
        Special rates for Team Finance Pro projects.
      </p>

      <style>{`.tf-btn:hover{background:${BLUE_HOVER}!important}.tf-btn-outline:hover{border-color:#B9C0D4!important}`}</style>
    </div>
  );
}
