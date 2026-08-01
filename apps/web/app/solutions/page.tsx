import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { ArrowRight, Blocks, Landmark, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Solutions | TxID Support",
  description:
    "One support and operations layer for DeFi protocols, issuers and tokenization platforms, and institutions. The same investigation engine, seen through each team's eyes.",
  alternates: { canonical: "/solutions" },
};

const AUDIENCES = [
  {
    icon: Blocks,
    href: "/solutions/protocols",
    name: "Protocols",
    line: "Your users' questions, answered like an engineer would.",
    detail: "DeFi and trading protocols whose users hit failed transactions and confusing errors at every hour.",
  },
  {
    icon: Landmark,
    href: "/solutions/issuers",
    name: "Issuers & tokenization platforms",
    line: "Assets on-chain means questions on-chain.",
    detail: "Stablecoin issuers, tokenization platforms, neobanks and wallets whose mainstream users meet on-chain problems.",
  },
  {
    icon: Building2,
    href: "/solutions/institutions",
    name: "Institutions",
    line: "Answer clients correctly, and defensibly.",
    detail: "Operations and compliance teams who must stand behind every client-facing answer about on-chain assets.",
  },
];

export default function SolutionsIndexPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20">
        <section className="pb-14">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">Solutions</p>
              <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                One layer, three teams.
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                Start with the page that sounds like your desk.
              </p>
            </FadeIn>
          </div>
        </section>
        <section>
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-4">
            {AUDIENCES.map((a, i) => (
              <FadeIn key={a.name} delay={i * 0.08}>
                <Link
                  href={a.href}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-7 hover:border-accent/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-5">
                    <a.icon className="w-5 h-5 text-accent" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-white mb-1.5">{a.name}</h2>
                  <p className="text-sm text-accent mb-3">{a.line}</p>
                  <p className="text-sm text-muted leading-relaxed flex-1">{a.detail}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                    Explore
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </FadeIn>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
