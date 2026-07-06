import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { WidgetMockup } from "./WidgetMockup";
import { APP_URL } from "@/lib/config";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.18) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <FadeIn delay={0.08}>
              <h1 className="font-display text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Expert support for every user.
                <br />
                <span className="text-accent">No support team needed.</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.16}>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
                AI that knows your protocol inside out. Answers questions and resolves issues automatically, so your team can focus on building.
              </p>
            </FadeIn>

            <FadeIn delay={0.24}>
              <div className="flex flex-wrap gap-3">
                <Button
                  href={`${APP_URL}/sign-up`}
                  variant="primary"
                  size="lg"
                >
                  Get started free
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/demo" variant="outline" size="lg">
                  <Play className="w-4 h-4" />
                  See it live
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.32}>
              <p className="text-xs text-muted mt-4 mb-6">
                No credit card required · 1,000 free conversations every month
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className="text-xs text-muted/50 font-mono shrink-0">Available on</span>
                {[
                  { name: "Ethereum", file: "Ethereum.png", whiteBg: false },
                  { name: "Solana",   file: "Solana.svg",   whiteBg: false },
                  { name: "Base",     file: "Base.png",     whiteBg: true  },
                  { name: "Arbitrum", file: "Arbitrum.png", whiteBg: false },
                  { name: "Polygon",  file: "Polygon.png",  whiteBg: true  },
                  { name: "Optimism", file: "Optimism.png", whiteBg: false },
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
          </div>

          <FadeIn delay={0.2} direction="left" className="flex justify-center lg:justify-end">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-3xl scale-95"
                style={{ background: "rgba(99, 102, 241, 0.15)" }}
              />
              <WidgetMockup className="relative" />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
