import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { ResolutionFlow } from "./ResolutionFlow";
import { HeroTxCheck } from "./HeroTxCheck";

export function Hero() {
  return (
    <section className="relative flex items-center pt-28 pb-12 lg:pb-16 overflow-hidden">
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(75, 71, 233, 0.20) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full">
        {/* Text column runs wider than the visual: the mockup is capped at
            max-w-md anyway, and the headline needs the room to sit on two
            lines instead of three. */}
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
          <div>
            <FadeIn delay={0.08}>
              <h1 className="font-display text-4xl sm:text-5xl xl:text-[52px] font-bold text-white leading-[1.1] tracking-tight mb-6">
                The resolution layer
                {/* Forced two-line break on desktop only; small screens wrap
                    naturally rather than stacking four short lines. */}
                <br className="hidden lg:block" />{" "}
                for <span className="text-accent">on-chain products</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.16}>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
                Every chain, wallet and contract describes failure differently. TxID turns that into one answer: what happened, whether funds moved, who acts next, and the evidence behind it. Delivered to your product, your support team, or your code.
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
                Read-only · No custody · Evidence on every answer · No financial advice
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className="text-xs text-muted/50 font-mono shrink-0">Available on</span>
                {[
                  { name: "Aptos",    file: "Aptos.png",    whiteBg: true  },
                  { name: "Ethereum", file: "Ethereum.png", whiteBg: false },
                  { name: "Base",     file: "Base.png",     whiteBg: true  },
                  { name: "Arbitrum", file: "Arbitrum.png", whiteBg: false },
                  { name: "Polygon",  file: "Polygon.png",  whiteBg: true  },
                  { name: "Optimism", file: "Optimism.png", whiteBg: false },
                  { name: "Avalanche", file: "Avalanche.png", whiteBg: false },
                  { name: "Etherlink", file: "Etherlink.png", whiteBg: false },
                  { name: "BNB",      file: "BNB.png",      whiteBg: false },
                ].map(({ name, file, whiteBg }) => (
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
                      src={`/chains/${file}`}
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
                className="absolute inset-0 rounded-full blur-3xl scale-90"
                style={{ background: "rgba(75, 71, 233, 0.18)" }}
              />
              <ResolutionFlow className="relative w-full max-w-[520px] lg:max-w-[620px]" />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
