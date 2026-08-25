import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { ChainLogo } from "@/components/chains/ChainLogo";
import { VISIBLE_CHAINS, hexToRgba, type ChainInfo } from "@/lib/chains";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Supported Chains | TxID",
  description:
    "TxID diagnoses failed transactions natively across each supported network, understanding the execution model, contract behaviour, and failure patterns unique to each ecosystem. 9 chains live, including Move-native Aptos.",
  alternates: { canonical: "/chains" },
};

function ChainCard({ chain }: { chain: ChainInfo }) {
  return (
    <Link
      href={`/chains/${chain.slug}`}
      className="group flex h-full flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 transition-colors hover:border-[color:var(--hover)]"
      style={{ ["--hover" as string]: hexToRgba(chain.color, 0.4) }}
    >
      {/* No status pill: the section heading already says these are live, and a
          per-card pill inherits each chain's brand colour, so the row reads as
          nine different colours rather than one state. No ticker either: the
          name carries the card. */}
      <div className="flex items-center gap-3 mb-3">
        <ChainLogo src={chain.logo} name={chain.name} color={chain.color} size={36} whiteBg={chain.logoWhiteBg} />
        <h3 className="font-display font-semibold text-white truncate">{chain.name}</h3>
      </div>
      {/* Fixed two-line tagline zone so every card sits at the same height. */}
      <p className="text-sm text-muted leading-relaxed mb-3 line-clamp-3 min-h-[4.35em] flex-1">{chain.tagline}</p>
      <span className="inline-flex items-center gap-1 text-xs font-medium mt-auto" style={{ color: chain.color }}>
        View {chain.name} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function ChainsPage() {
  // Live chains only. The coming-soon entries keep their detail pages (deep
  // links and SEO), but a "roadmap" section under nine live chains read as
  // filler, so the index doesn't advertise them. Grouped by family: the two
  // execution models are genuinely different products under the hood, and the
  // split gives Move-native Aptos its own stage.
  const liveChains = VISIBLE_CHAINS.filter((c) => c.status === "live");
  const evm = liveChains.filter((c) => c.family === "evm");
  const nonEvm = liveChains.filter((c) => c.family === "non-evm");

  return (
    <>
      <Navbar />
      <main className="pt-24">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[380px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(75, 71, 233,0.15) 0%, transparent 70%)" }}
          />
          <div className="max-w-6xl mx-auto px-6 pt-10 pb-14 text-center relative">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-4">Chains</p>
              <h1 className="font-display text-5xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
                One intelligence layer.
                <br />
                <span className="text-accent">Every chain your users are on.</span>
              </h1>
              <p className="text-lg text-muted max-w-2xl mx-auto mb-3">
                TxID diagnoses failed transactions natively across each supported network,
                understanding the execution model, contract behaviour, and failure patterns
                unique to each ecosystem.
              </p>
              <p className="text-lg text-muted max-w-2xl mx-auto">
                9 chains live, including Move-native Aptos.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* EVM */}
        <section className="py-10">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="font-display text-2xl font-bold text-white">EVM</h2>
                <p className="text-sm text-muted">{evm.length} chains live</p>
              </div>
              <p className="text-sm text-muted mb-6 max-w-2xl">
                One engine across every EVM network: real revert decoding, gas and approval checks,
                and wrong-network fixes, tuned to each chain&apos;s own quirks.
              </p>
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
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="font-display text-2xl font-bold text-white">Non-EVM</h2>
                <p className="text-sm text-muted">{nonEvm.length === 1 ? "1 chain live" : `${nonEvm.length} chains live`}</p>
              </div>
              <p className="text-sm text-muted mb-6 max-w-2xl">
                Non-EVM ecosystems get their own native engine, not an EVM adapter. On Aptos that
                means Move aborts, subaccounts and sponsored transactions, handled first-class.
              </p>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nonEvm.map((c, i) => (
                <FadeIn key={c.slug} delay={(i % 3) * 0.05}>
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
