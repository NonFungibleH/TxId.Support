"use client";

import { useState } from "react";
import { Check } from "lucide-react";

// Team Finance landing page ONLY. Deliberately a standalone component, not the
// shared PricingSection, so these partner package prices never surface on the
// main txid.support pricing page. Numbers approved 2026-08-13.

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
      "Docs Q&A and transaction diagnosis",
      "The case record on every answer",
      "Email support",
    ],
  },
  {
    name: "Growth",
    monthly: 799,
    resolutions: "2,000",
    overage: "$0.79",
    tagline: "Everything a live protocol needs.",
    popular: true,
    features: [
      "Everything in Starter, plus:",
      "Widget, Telegram and API",
      "Slack, Discord, Linear, GitHub and Jira",
      "Full case record with export",
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

/** Annual is 2 months free: the shown /mo figure is the annual total over 12. */
const annualMonthly = (m: number) => Math.round((m * 10) / 12);

// Every plan covers one chain; extra chains are a flat add-on. Suggested; adjust
// with the tier numbers if the partnership wants a different figure.
const PER_CHAIN = "$99";

export function PricingPackages() {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${annual ? "text-slate-400" : "text-slate-900"}`}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Toggle annual billing"
          onClick={() => setAnnual((a) => !a)}
          className={`relative h-6 w-11 rounded-full transition-colors ${annual ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
        <span className={`text-sm font-medium ${annual ? "text-slate-900" : "text-slate-400"}`}>
          Annual
        </span>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          2 months free
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {TIERS.map((tier) => {
          const price = annual ? annualMonthly(tier.monthly) : tier.monthly;
          return (
            <div
              key={tier.name}
              className={`relative flex h-full flex-col rounded-2xl bg-white p-7 ${
                tier.popular
                  ? "border-2 border-blue-600 shadow-lg md:-mt-3 md:mb-3"
                  : "border border-slate-200 shadow-sm"
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}

              <h3 className="font-display text-xl font-bold text-slate-900">{tier.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{tier.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold text-slate-900">${price.toLocaleString()}</span>
                <span className="text-sm text-slate-500">/mo</span>
              </div>
              <p className="mt-1 h-4 text-xs text-slate-400">
                {annual ? `$${(price * 12).toLocaleString()} billed yearly` : "billed monthly"}
              </p>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-900">
                  <span className="font-semibold">{tier.resolutions}</span> resolutions included
                </p>
                <p className="mt-1 text-xs text-slate-500">then {tier.overage} per resolution</p>
                <p className="mt-2.5 border-t border-slate-200 pt-2.5 text-sm text-slate-900">
                  <span className="font-semibold">1 chain</span> included
                </p>
                <p className="mt-1 text-xs text-slate-500">add more from {PER_CHAIN}/mo each</p>
              </div>

              <a
                href={contactHref(tier.name)}
                className={`mt-6 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                  tier.popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-slate-300 text-slate-900 hover:border-blue-600 hover:text-blue-600"
                }`}
              >
                Get started with {tier.name}
              </a>

              <ul className="mt-6 space-y-2.5">
                {tier.features.map((f) => {
                  const isHeader = f.startsWith("Everything in");
                  return (
                    <li
                      key={f}
                      className={`flex items-start gap-2.5 text-sm ${
                        isHeader ? "font-semibold text-slate-900 pt-1" : "text-slate-600"
                      }`}
                    >
                      {!isHeader && <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                      <span>{f}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Enterprise strip */}
      <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row">
        <div>
          <p className="font-display text-lg font-bold text-slate-900">Enterprise</p>
          <p className="text-sm text-slate-500">
            Unlimited volume, white-label, custom SLA and security review.
          </p>
        </div>
        <a
          href={contactHref("Enterprise")}
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:border-blue-600 hover:text-blue-600 transition-colors"
        >
          Talk to us
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400 max-w-2xl mx-auto">
        A resolution is one support conversation, from the user&apos;s first message until it ends:
        the agent answers it, or it is escalated to your team. Each plan covers one chain; add more
        from {PER_CHAIN}/mo each. Special rates for projects that come through Team Finance.
      </p>
    </div>
  );
}
