import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { ClosingCTA } from "@/components/sections/ClosingCTA";

export const metadata: Metadata = {
  title: "Capabilities | TxID Support",
  description:
    "Everything the TxID layer does: wallet detection, transaction diagnostics, docs Q&A, Telegram support, team integrations, the operational record, and more, across EVM chains and Aptos.",
  alternates: { canonical: "/capabilities" },
};

export default function CapabilitiesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        <section className="pb-2">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">Capabilities</p>
              <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                Everything the layer does.
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                The full capability set behind Investigate, Resolve, and Record.
              </p>
            </FadeIn>
          </div>
        </section>
        <FeatureGrid />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
