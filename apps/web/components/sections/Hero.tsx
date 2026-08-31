import { ArrowRight, Eye, FileCheck2, ScrollText, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { LayerStack } from "./LayerStack";
import { HeroTxCheck } from "./HeroTxCheck";

/**
 * Trust facts as a STRUCTURED row, not a dot-separated line.
 *
 * These were previously run together as one string of small grey text, which
 * reads as a disclaimer people skip. Four of them, each with an icon, a claim
 * and the qualifier underneath, reads as a specification. Same words, and the
 * difference is entirely information design.
 *
 * Every claim here is one we can defend. Nothing about certification: an
 * external audit already corrected overstated compliance language once, and
 * "evidence on every answer" is what we actually do.
 */
const TRUST = [
  { icon: Eye, claim: "Read-only", note: "Never moves funds" },
  { icon: ScrollText, claim: "Audit-logged", note: "Every interaction" },
  { icon: FileCheck2, claim: "Evidence-backed", note: "On every answer" },
  { icon: Scale, claim: "No financial advice", note: "Support only" },
];

const CHAINS = [
  { name: "Ethereum", file: "Ethereum.png", whiteBg: false },
  { name: "Base", file: "Base.png", whiteBg: true },
  { name: "Arbitrum", file: "Arbitrum.png", whiteBg: false },
  { name: "Aptos", file: "Aptos.png", whiteBg: true },
  { name: "BNB Chain", file: "BNB.png", whiteBg: false },
  { name: "Polygon", file: "Polygon.png", whiteBg: true },
  { name: "Optimism", file: "Optimism.png", whiteBg: false },
  { name: "Avalanche", file: "Avalanche.png", whiteBg: false },
  { name: "Etherlink", file: "Etherlink.png", whiteBg: false },
];

export function Hero() {
  return (
    <section className="relative flex items-center pt-28 pb-14 overflow-hidden">
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(75, 71, 233, 0.20) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
          <div>
            <FadeIn delay={0.04}>
              <span className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-[var(--border-accent)] bg-accent-muted font-mono text-[11px] uppercase tracking-wider text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                Early access · Evaluation tier opening soon
              </span>
            </FadeIn>

            <FadeIn delay={0.08}>
              {/* The live wording, verbatim. It is on every deck, one-pager and
                  email already sent, so the site must not be the one surface
                  saying something different. */}
              <h1 className="font-display text-4xl sm:text-5xl xl:text-[52px] font-bold text-white leading-[1.08] tracking-tight mb-5">
                The support layer
                <br className="hidden lg:block" />{" "}
                for <span className="text-accent">on-chain finance</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.16}>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
                Users get guided support backed by live on-chain data. Your support team handles fewer tickets, while your compliance team has a complete audit trail of every interaction.
              </p>
            </FadeIn>

            <FadeIn delay={0.24}>
              <div className="flex flex-wrap gap-3 mb-9">
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

            <FadeIn delay={0.3}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-5 mb-8 pb-8 border-b border-[var(--border)]">
                {TRUST.map(({ icon: Icon, claim, note }) => (
                  <div key={claim}>
                    <Icon className="h-4 w-4 text-accent mb-2" />
                    <p className="text-[13px] font-semibold text-white leading-tight">{claim}</p>
                    <p className="text-[11px] text-subtle mt-0.5">{note}</p>
                  </div>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={0.34}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                <span className="text-[11px] text-subtle font-mono shrink-0">Available on</span>
                {CHAINS.map(({ name, file, whiteBg }) => (
                  <span key={name} className="inline-flex items-center gap-1.5 shrink-0">
                    <span
                      className={[
                        "h-4 w-4 shrink-0 rounded-full flex items-center justify-center",
                        whiteBg ? "bg-white p-[2px]" : "overflow-hidden",
                      ].join(" ")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/chains/${file}`} alt="" className="w-full h-full object-contain" />
                    </span>
                    <span className="text-[11px] text-muted">{name}</span>
                  </span>
                ))}
              </div>
            </FadeIn>

            <FadeIn delay={0.38}>
              <HeroTxCheck />
            </FadeIn>
          </div>

          <FadeIn delay={0.2} direction="left" className="flex justify-center lg:justify-end w-full">
            <div className="relative w-full">
              <div
                className="absolute inset-0 rounded-full blur-3xl scale-90"
                style={{ background: "rgba(75, 71, 233, 0.18)" }}
              />
              <LayerStack className="relative w-full max-w-[520px] lg:max-w-[640px]" />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
