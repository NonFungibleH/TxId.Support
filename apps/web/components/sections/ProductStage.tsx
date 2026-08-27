import { FadeIn } from "@/components/ui/FadeIn";

/**
 * One numbered stage on a FlowRail spine.
 *
 * Extracted from /how-it-works so every product page (SDK, API, Console) is
 * built from the same parts rather than three near-identical copies drifting
 * apart. The rail signals progression, which is why there are no dividers and
 * why the stages share a minimum height: the line IS the structure.
 */
export function ProductStage({
  n,
  who,
  title,
  paras,
  emphasis,
  visualLabel,
  children,
  flip,
}: {
  n: string;
  who: string;
  title: string;
  paras: string[];
  emphasis?: string;
  visualLabel?: string;
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="relative py-10 lg:py-8 lg:min-h-[440px] lg:flex lg:items-center">
      <div className="w-full max-w-6xl mx-auto pl-14 pr-6 lg:px-6">
        <div className={`grid lg:grid-cols-2 gap-10 items-center ${flip ? "lg:[direction:rtl]" : ""}`}>
          <FadeIn className="lg:[direction:ltr]">
            <p className="font-mono text-sm text-accent mb-2">
              {n} · {who}
            </p>
            <h2 className="font-display text-3xl font-bold text-white mb-4">{title}</h2>
            <div className="space-y-3 max-w-lg">
              {paras.map((p) => (
                <p key={p} className="text-muted leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
            {emphasis && (
              <p className="mt-4 max-w-lg text-sm text-[#c8c8d8] border-l-2 border-accent/50 pl-4">
                {emphasis}
              </p>
            )}
          </FadeIn>
          <FadeIn delay={0.1} className="lg:[direction:ltr]">
            {visualLabel && (
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted/60 mb-3 lg:text-left">
                {visualLabel}
              </p>
            )}
            {children}
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/** The shared page intro above the rail. */
export function ProductIntro({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
}) {
  return (
    <section className="pb-10">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <FadeIn>
          <p className="font-mono text-sm text-accent mb-3">{eyebrow}</p>
          <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
            {title}
          </h1>
          <p className="text-lg text-muted leading-relaxed">{blurb}</p>
        </FadeIn>
      </div>
    </section>
  );
}
