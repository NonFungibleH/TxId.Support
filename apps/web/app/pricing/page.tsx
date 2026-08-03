import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingSection } from "@/components/sections/PricingSection";
import { ClosingCTA } from "@/components/sections/ClosingCTA";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "Pricing | TxID",
  description:
    "Prove TxID on your own protocol with the Evaluation tier, then deploy it as infrastructure on an Enterprise plan priced to your platform.",
  alternates: { canonical: "/pricing" },
};

// Three things a buyer asks before they email us. The homepage FAQ answers
// these too, but someone who lands straight on /pricing never sees it.
const NOTES = [
  {
    title: "What counts as a conversation",
    body: "A conversation starts when a user sends their first message and ends after 30 minutes of inactivity. Follow-up questions in the same session count once.",
  },
  {
    title: "How Enterprise is priced",
    body: "We price to your platform: the chains you are on, the volume you run, and the surfaces you deploy. There is no per-seat licence and no long-term contract.",
  },
  {
    title: "What happens to your record",
    body: "Every conversation is logged as a case record on both tiers, with the on-chain evidence behind it. Your data stays yours, and you can export it.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <div className="max-w-6xl mx-auto px-6 text-center pt-10 pb-0">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">{"Pricing"}</p>
            <h1 className="font-display text-5xl font-bold text-white mb-4">
              Priced to your platform
            </h1>
            <p className="text-lg text-muted max-w-xl mx-auto">
              Test the intelligence on your own protocol first. Deploy it as
              infrastructure when you are ready.
            </p>
          </FadeIn>
        </div>

        <PricingSection />

        <div className="max-w-5xl mx-auto px-6 pt-4 pb-20">
          <div className="grid md:grid-cols-3 gap-4">
            {NOTES.map((note, i) => (
              <FadeIn key={note.title} delay={i * 0.06}>
                <div className="h-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
                  <p className="font-display font-semibold text-white text-sm mb-2">
                    {note.title}
                  </p>
                  <p className="text-sm text-muted leading-relaxed">{note.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
