import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { InvestigationMockup } from "./InvestigationMockup";
import { HeroTxCheck } from "./HeroTxCheck";
import { VISIBLE_CHAINS } from "@/lib/chains";

/**
 * DERIVED, not a second list. This strip was hand-maintained and was missing
 * Robinhood Chain within the hour of it going live, while /chains had it. One
 * source of truth, non-EVM first because Move is the differentiator, and
 * cross-chain excluded: LayerZero is not somewhere the product is "available
 * on", it is a layer that runs across the rest.
 */
const HERO_CHAINS = VISIBLE_CHAINS
  .filter((c) => c.status === "live" && c.family !== "cross-chain")
  .sort((a, b) => (a.family === b.family ? 0 : a.family === "non-evm" ? -1 : 1));

export function Hero() {
  return (
    <section className="relative flex items-center pt-28 pb-12 lg:pb-16 overflow-hidden">
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.18) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full">
        {/* Text column runs wider than the visual: the mockup is capped at
            max-w-md anyway, and the headline needs the room to sit on two
            lines instead of three. */}
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-12 items-center">
          <div>
            <FadeIn delay={0.08}>
              <h1 className="font-display text-4xl sm:text-5xl xl:text-[52px] font-bold text-white leading-[1.1] tracking-tight mb-6">
                The support layer
                {/* Forced two-line break on desktop only; small screens wrap
                    naturally rather than stacking four short lines. */}
                <br className="hidden lg:block" />{" "}
                for <span className="text-accent">on-chain finance</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.16}>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
                Users get guided support backed by live on-chain data. Your support team handles fewer tickets, while your compliance team has a complete audit trail of every interaction.
              </p>
            </FadeIn>

            <FadeIn delay={0.24}>
              <div className="flex flex-wrap gap-3">
                <Button href="/check" variant="primary" size="lg">
                  Try it live
                </Button>
                <Button
                  href="mailto:team@txid.support?subject=TxID early access"
                  variant="outline"
                  size="lg"
                >
                  Request access
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.32}>
              <p className="text-xs text-muted mt-4 mb-2">
                Early access: we onboard teams personally · Evaluation tier opening soon
              </p>
              <p className="text-xs text-muted/70 mb-6 inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-accent/70 shrink-0" />
                Read-only · No custody · Audit-logged · No financial advice
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className="text-xs text-muted/50 font-mono shrink-0">Available on</span>
                {HERO_CHAINS.map(({ name, logo, logoWhiteBg: whiteBg }) => (
                  <div
                    key={name}
                    title={name}
                    className={[
                      "h-5 w-5 shrink-0 rounded-full flex items-center justify-center",
                      whiteBg
                        ? "bg-white p-[3px]"          // white circle, no overflow-hidden so square stays square
                        : "overflow-hidden",           // clip any non-circular logos to circle
                    ].join(" ")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo}
                      alt={name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={0.36}>
              <HeroTxCheck />
            </FadeIn>
          </div>

          <FadeIn delay={0.2} direction="left" className="flex justify-center lg:justify-end">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-3xl scale-95"
                style={{ background: "rgba(99, 102, 241, 0.15)" }}
              />
              <InvestigationMockup className="relative" />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
