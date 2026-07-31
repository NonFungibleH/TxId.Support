import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Check } from "lucide-react";

export interface SolutionData {
  badge: string;
  headline: React.ReactNode;
  sub: string;
  pains: { title: string; detail: string }[];
  delivers: string[];
  visual: React.ReactNode;
  visualCaption: string;
  ctaPrimary?: { label: string; href: string };
}

/**
 * Shared frame for the three audience pages. Same skeleton, so the Solutions
 * set reads as one platform seen through three buyers' eyes: their pains,
 * what the layer delivers for them, and one proof visual.
 */
export function SolutionLayout({ s }: { s: SolutionData }) {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        {/* Hero */}
        <section className="pb-14">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="font-mono text-sm text-accent mb-3">Solutions · {s.badge}</p>
              <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                {s.headline}
              </h1>
              <p className="text-lg text-muted leading-relaxed">{s.sub}</p>
            </FadeIn>
          </div>
        </section>

        {/* Pains */}
        <section className="pb-14">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-4">
              {s.pains.map((p, i) => (
                <FadeIn key={p.title} delay={i * 0.08}>
                  <div className="h-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
                    <h3 className="font-display font-semibold text-white mb-2">{p.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{p.detail}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* What the layer delivers + visual */}
        <section className="py-14 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <FadeIn>
                <p className="font-mono text-sm text-accent mb-3">What the layer delivers</p>
                <ul className="space-y-3.5">
                  {s.delivers.map((d) => (
                    <li key={d} className="flex items-start gap-3 text-[15px] text-[#c8c8d8] leading-relaxed">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-1" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </FadeIn>
              <FadeIn delay={0.1}>
                <div>
                  {s.visual}
                  <p className="text-center text-xs text-muted/60 font-mono mt-4">{s.visualCaption}</p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">See it working, then talk to us</h2>
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                <Button href={s.ctaPrimary?.href ?? "/check"} variant="primary" size="lg">
                  {s.ctaPrimary?.label ?? "Try it live"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="mailto:team@txid.support?subject=TxID early access" variant="outline" size="lg">
                  Request access
                </Button>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
