"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Search, CheckCircle2, Users, Archive, ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { FadeIn } from "@/components/ui/FadeIn";

// The whole company's view of one investigation. A live diagram, not a static
// strip: the case travels stage to stage along the beam, each stop lighting up
// with what that part of the company sees. Full journey at /how-it-works.
const STAGES = [
  {
    icon: MessageCircle,
    who: "Your user",
    title: "Gets help anywhere",
    detail: "On your website or in Telegram. Connects their wallet in one tap.",
    chip: "“Why did my swap fail?”",
  },
  {
    icon: Search,
    who: "TxID",
    title: "Investigates the transaction",
    detail: "Reads live on-chain data, decodes the error, and identifies exactly what happened.",
    chip: "Transaction analysed · Error decoded · Root cause found",
  },
  {
    icon: CheckCircle2,
    who: "Your user",
    title: "Gets the fix in seconds",
    detail: "Clear guidance to resolve the issue without waiting for support.",
    chip: "Fix: Increase slippage to 0.5%",
  },
  {
    icon: Users,
    who: "Your team",
    title: "Sees only what needs attention",
    detail: "Complex issues are escalated automatically with the full transaction context attached.",
    chip: "Case #4821 → Slack #support",
  },
  {
    icon: Archive,
    who: "Compliance & product",
    title: "Keeps the record",
    detail: "Every case is filed with its evidence, ready to review or report on.",
    chip: "Filed · compliance-ready",
  },
];

const STEP_MS = 2400;

export function CompanyFlow() {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setActive(a => (a + 1) % STAGES.length), STEP_MS);
    return () => clearInterval(t);
  }, [reduced]);

  // Beam fill: percentage of the connector line lit, up to the active stage.
  const beamPct = (active / (STAGES.length - 1)) * 100;

  return (
    <section className="py-16 border-t border-[var(--border)] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="font-mono text-sm text-accent mb-3">The flow</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Follow a user issue from start to resolution.
            </h2>
            <p className="text-muted max-w-2xl mx-auto">
              Tap each stage to see how everyone benefits.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          {/* Desktop: horizontal beam behind the cards. Mobile: vertical rail. */}
          <div className="relative">
            {/* Horizontal connector (desktop) */}
            <div className="hidden md:block absolute left-[10%] right-[10%] top-[26px] h-px bg-[var(--border)]">
              <div
                className="h-px bg-gradient-to-r from-accent/40 via-accent to-accent transition-all ease-in-out"
                style={{ width: `${beamPct}%`, transitionDuration: `${STEP_MS * 0.6}ms` }}
              />
              {/* The travelling case */}
              <div
                className="absolute -top-[9px] -ml-[9px] transition-all ease-in-out"
                style={{ left: `${beamPct}%`, transitionDuration: `${STEP_MS * 0.6}ms` }}
              >
                <span className="flex w-[18px] h-[18px] items-center justify-center rounded-full bg-accent shadow-[0_0_18px_5px_rgba(75, 71, 233,0.55)]">
                  <FileText className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
            </div>

            {/* Vertical connector (mobile) */}
            <div className="md:hidden absolute left-[27px] top-4 bottom-4 w-px bg-[var(--border)]">
              <div
                className="w-px bg-gradient-to-b from-accent/40 via-accent to-accent transition-all ease-in-out"
                style={{ height: `${beamPct}%`, transitionDuration: `${STEP_MS * 0.6}ms` }}
              />
              <div
                className="absolute -left-[9px] -mt-[9px] transition-all ease-in-out"
                style={{ top: `${beamPct}%`, transitionDuration: `${STEP_MS * 0.6}ms` }}
              >
                <span className="flex w-[18px] h-[18px] items-center justify-center rounded-full bg-accent shadow-[0_0_18px_5px_rgba(75, 71, 233,0.55)]">
                  <FileText className="w-2.5 h-2.5 text-white" />
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-4 md:gap-3">
              {STAGES.map((s, i) => {
                const isActive = i === active;
                const isPast = i < active;
                return (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`${s.who}: ${s.title}`}
                    className={clsx(
                      "relative text-left rounded-xl border p-4 pl-14 md:pl-4 md:pt-12 transition-all duration-500 cursor-pointer",
                      isActive
                        ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_32px_-8px_rgba(75, 71, 233,0.45)] md:-translate-y-1"
                        : isPast
                          ? "border-[var(--border)] bg-[var(--bg-surface)] opacity-90"
                          : "border-[var(--border)] bg-[var(--bg-surface)] opacity-60",
                    )}
                  >
                    {/* Node on the beam */}
                    <span
                      className={clsx(
                        "absolute left-[18px] top-4 md:left-1/2 md:-translate-x-1/2 md:top-[14px] flex w-9 h-9 items-center justify-center rounded-full border transition-colors duration-500 bg-[#0b0c14]",
                        isActive || isPast ? "border-accent/60" : "border-[var(--border)]",
                      )}
                    >
                      <s.icon
                        className={clsx(
                          "w-4 h-4 transition-colors duration-500",
                          isActive ? "text-accent animate-pulse" : isPast ? "text-accent/70" : "text-muted/50",
                        )}
                      />
                    </span>

                    <p className={clsx("font-mono text-[10px] uppercase tracking-widest mb-1 transition-colors", isActive ? "text-accent" : "text-muted/60")}>
                      {s.who}
                    </p>
                    <h3 className="text-sm font-semibold text-white mb-1">{s.title}</h3>
                    <p className="text-xs text-muted leading-relaxed mb-2.5">{s.detail}</p>
                    <p
                      className={clsx(
                        "inline-block rounded-md border px-2 py-1 text-[10px] font-mono transition-all duration-500",
                        isActive
                          ? "border-accent/40 bg-accent/10 text-accent opacity-100"
                          : "border-transparent text-muted/40 opacity-0 md:opacity-0",
                      )}
                    >
                      {s.chip}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="text-center mt-10">
            <Link
              href="/sdk"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              See the full journey, stage by stage
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
