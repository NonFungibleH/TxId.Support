import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { ChainLogo } from "@/components/chains/ChainLogo";
import { CHAINS, hexToRgba, type ChainInfo } from "@/lib/chains";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Supported Chains | TxID Support",
  description:
    "TxID Support diagnoses failed transactions across every major EVM chain (Ethereum, Base, BNB Chain, Polygon, Arbitrum, Optimism, Avalanche), with Solana, Stellar, TON and Aptos on the way.",
  alternates: { canonical: "/chains" },
};

function ChainCard({ chain }: { chain: ChainInfo }) {
  const live = chain.status === "live";
  return (
    <Link
      href={`/chains/${chain.slug}`}
      className="group block bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 transition-colors hover:border-[color:var(--hover)]"
      style={{ ["--hover" as string]: hexToRgba(chain.color, 0.4) }}
    >
      <div className="flex items-center gap-3 mb-3">
        <ChainLogo src={chain.logo} name={chain.name} color={chain.color} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-white truncate">{chain.name}</h3>
            <span
              className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-full"
              style={{
                border: `1px solid ${hexToRgba(chain.color, live ? 0.4 : 0.25)}`,
                background: hexToRgba(chain.color, 0.1),
                color: chain.color,
              }}
            >
              {live ? "Live" : "Soon"}
            </span>
          </div>
          <p className="text-[11px] text-muted font-mono">{chain.ticker}</p>
        </div>
      </div>
      <p className="text-sm text-muted leading-relaxed mb-3">{chain.tagline}</p>
      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: chain.color }}>
        View {chain.name} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function ChainsPage() {
  const evm = CHAINS.filter((c) => c.family === "evm");
  const nonEvm = CHAINS.filter((c) => c.family === "non-evm");

  return (
    <>
      <Navbar />
      <main className="pt-24">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[380px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, transparent 70%)" }}
          />
          <div className="max-w-6xl mx-auto px-6 pt-10 pb-14 text-center relative">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-4">Chains</p>
              <h1 className="font-display text-5xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
                One support agent.
                <br />
                <span className="text-accent">Every chain your users are on.</span>
              </h1>
              <p className="text-lg text-muted max-w-2xl mx-auto">
                TxID diagnoses failed transactions natively on each chain, decoding the real cause and the fix, not a
                generic FAQ. Live across the major EVM networks, with the biggest non-EVM ecosystems on the way.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* EVM */}
        <section className="py-10">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-display text-2xl font-bold text-white">Live now: EVM</h2>
                <p className="text-sm text-muted">{evm.length} chains</p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {evm.map((c, i) => (
                <FadeIn key={c.slug} delay={(i % 3) * 0.05}>
                  <ChainCard chain={c} />
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Non-EVM */}
        <section className="py-10 pb-24">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-display text-2xl font-bold text-white">On the roadmap: non-EVM</h2>
                <p className="text-sm text-muted">{nonEvm.length} chains</p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {nonEvm.map((c, i) => (
                <FadeIn key={c.slug} delay={(i % 4) * 0.05}>
                  <ChainCard chain={c} />
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
