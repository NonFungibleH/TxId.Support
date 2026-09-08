import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { InvestigationMockup } from "./InvestigationMockup";
import { HeroTxCheck } from "./HeroTxCheck";
import Link from "next/link";
import { LIVE_CHAIN_COUNT } from "./ChainMarquee";

/**
 * The hero states the NUMBER and the marquee below shows the marks.
 *
 * It used to render every logo here. That worked at six chains and stopped
 * working at twenty: the badges were 20px, wrapped onto three lines, and were
 * too small to recognise, so the strip read as clutter rather than as the proof
 * point it was meant to be. The count still comes from the chain registry, so
 * it cannot drift the way the old hand-maintained list did (that one was
 * missing Robinhood Chain within an hour of it going live).
 */

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
              <p className="text-xs text-muted/50 font-mono">
                Available on{" "}
                <Link
                  href="/chains"
                  className="text-muted hover:text-accent transition-colors underline decoration-dotted underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded"
                >
                  {LIVE_CHAIN_COUNT} chains
                </Link>
              </p>
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
