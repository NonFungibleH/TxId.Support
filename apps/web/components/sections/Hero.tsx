import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { WidgetMockup } from "./WidgetMockup";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <FadeIn delay={0}>
              <div className="inline-flex items-center gap-2 bg-accent-muted border border-[var(--border-accent)] rounded-full px-3 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-xs font-mono text-accent">
                  Now in beta — free for early protocols
                </span>
              </div>
            </FadeIn>

            <FadeIn delay={0.08}>
              <h1 className="font-display text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Give every user{" "}
                <span className="text-accent">instant, expert support</span>{" "}
                — without the overhead.
              </h1>
            </FadeIn>

            <FadeIn delay={0.16}>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
                TxID Support embeds an AI widget directly into your protocol.
                It answers questions, diagnoses failed transactions, and surfaces
                your docs in real time — so every user gets a great experience,
                not just the ones who find your Discord.
              </p>
            </FadeIn>

            <FadeIn delay={0.24}>
              <div className="flex flex-wrap gap-3">
                <Button
                  href="https://app.txid.support/sign-up"
                  variant="primary"
                  size="lg"
                >
                  Add it to your protocol
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/demo" variant="outline" size="lg">
                  <Play className="w-4 h-4" />
                  See it live
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.32}>
              <p className="text-xs text-muted mt-4">
                No credit card required · Free tier includes 50 conversations/mo
              </p>
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
