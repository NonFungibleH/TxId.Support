import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { ChainLogo } from "@/components/chains/ChainLogo";
import { VISIBLE_CHAINS, hexToRgba, type ChainInfo } from "@/lib/chains";
import { ArrowRight } from "lucide-react";

/** Counted, not typed by hand: the hero copy carried "9 chains live" into the
 *  hour a tenth went live. */
const LIVE_CHAIN_COUNT = VISIBLE_CHAINS.filter(
  (c) => c.status === "live" && c.family !== "cross-chain",
).length;

export const metadata: Metadata = {
  title: "Supported Chains | TxID",
  description:
    `TxID diagnoses failed transactions natively across each supported network, understanding the execution model, contract behaviour, and failure patterns unique to each ecosystem. ${LIVE_CHAIN_COUNT} chains live, including Move-native Aptos, plus cross-chain transfers through LayerZero.`,
  alternates: { canonical: "/chains" },
};

function ChainCard({ chain }: { chain: ChainInfo }) {
  return (
    <Link
      href={`/chains/${chain.slug}`}
      className="group flex h-full flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 transition-colors hover:border-[color:var(--hover)]"
      style={{ ["--hover" as string]: hexToRgba(chain.color, 0.4) }}
    >
      {/* No status pill on the tile: the grid reads as one set. Status is not
          hidden, it is stated on each chain's own page, which is where someone
          deciding whether to build on it will look. No ticker either: the name
          carries the card. */}
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
  // Coming-soon chains are shown as tiles, badged, rather than hidden: where we
  // are going next is a signal buyers actually want, and each already has a
  // detail page. Grouped by family, because the execution models are genuinely
  // different products underneath, and LayerZero is not a chain at all.
  const evm = VISIBLE_CHAINS.filter((c) => c.family === "evm");
  const nonEvm = VISIBLE_CHAINS.filter((c) => c.family === "non-evm");
  const crossChain = VISIBLE_CHAINS.filter((c) => c.family === "cross-chain");
  const liveCount = (list: ChainInfo[]) => list.filter((c) => c.status === "live").length;
  // Counts what is listed, not what is live. The hero carries the live figure,
  // and each chain's own page states its status: a section heading is the wrong
  // place to make a per-chain claim, and "1 live, 2 coming" reads as a caveat
  // on the whole section rather than on the two it applies to.
  const countLabel = (list: ChainInfo[]) => (list.length === 1 ? "1 chain" : `${list.length} chains`);

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
                {liveCount([...evm, ...nonEvm])} chains live, including Move-native Aptos,
                plus cross-chain transfers through LayerZero.
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
                <p className="text-sm text-muted">{countLabel(evm)}</p>
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
                <p className="text-sm text-muted">{countLabel(nonEvm)}</p>
              </div>
              <p className="text-sm text-muted mb-6 max-w-2xl">
                Non-EVM ecosystems get their own native engine, not an EVM adapter. On Aptos and Sui
                that means Move aborts and subaccounts handled first-class; on Stellar it means
                trustlines, reserves and path payments explained in the words users actually use.
                Solana is next.
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

        {/* Cross-chain. Its own section because a message layer is not a chain:
            filing it under either execution model would be wrong, and the whole
            point is that it runs across both. */}
        {crossChain.length > 0 && (
          <section className="py-10 pb-24 border-t border-[var(--border)]">
            <div className="max-w-6xl mx-auto px-6 pt-14">
              <FadeIn>
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="font-display text-2xl font-bold text-white">Cross-chain</h2>
                  <p className="text-sm text-muted">{liveCount(crossChain) === crossChain.length ? "Live" : "Coming soon"}</p>
                </div>
                <p className="text-sm text-muted mb-6 max-w-2xl">
                  Value that leaves one chain and arrives on another does so in two transactions,
                  and the user only ever sees the first. TxID follows it across and says where it
                  actually is.
                </p>
              </FadeIn>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {crossChain.map((c, i) => (
                  <FadeIn key={c.slug} delay={(i % 3) * 0.05}>
                    <ChainCard chain={c} />
                  </FadeIn>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>
      <Footer />
    </>
  );
}
