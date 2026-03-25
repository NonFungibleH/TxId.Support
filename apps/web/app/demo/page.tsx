import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { WidgetMockup } from "@/components/sections/WidgetMockup";

export const metadata: Metadata = {
  title: "Demo — TxID Support",
  description: "See the TxID Support widget in action.",
};

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">{"// Demo"}</p>
            <h1 className="font-display text-5xl font-bold text-white mb-4">
              See it in action
            </h1>
            <p className="text-lg text-muted max-w-lg mx-auto mb-12">
              The interactive demo is coming soon. Sign up to get early access
              and be the first to test it on your protocol.
            </p>
          </FadeIn>

          <FadeIn delay={0.1} className="flex justify-center mb-12">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-3xl scale-90"
                style={{ background: "rgba(99, 102, 241, 0.2)" }}
              />
              <WidgetMockup className="relative" />
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Button
              href="https://app.txid.support/sign-up"
              variant="primary"
              size="lg"
            >
              Get Early Access
            </Button>
          </FadeIn>
        </div>
      </main>
      <Footer />
    </>
  );
}
