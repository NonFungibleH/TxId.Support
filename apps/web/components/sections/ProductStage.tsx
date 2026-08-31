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

/**
 * The shared product-page hero: copy left, graphic right.
 *
 * /resolve already had this shape and it was the right one, so it became the
 * template rather than a fourth variation. Every product page now opens the
 * same way as the homepage, which is what makes them read as one family
 * instead of three pages built in three different weeks.
 *
 * `status` is a deliberate slot: a product that is not shipped has to say so
 * at the top, not in a footnote further down.
 */
export function ProductHero({
  eyebrow,
  status,
  title,
  blurb,
  actions,
  children,
}: {
  eyebrow: string;
  status?: { label: string; live?: boolean };
  title: React.ReactNode;
  blurb: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(75, 71, 233, 0.15) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-16 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <p className="font-mono text-sm text-accent">{eyebrow}</p>
              {status && (
                <span
                  className={[
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px]",
                    status.live
                      ? "border border-accent/40 bg-accent/10 text-accent"
                      : "border border-[var(--border)] bg-elevated text-muted",
                  ].join(" ")}
                >
                  {status.live && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  )}
                  {status.label}
                </span>
              )}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
              {title}
            </h1>
            <p className="text-lg text-muted leading-relaxed mb-6 max-w-lg">{blurb}</p>
            {actions}
          </FadeIn>
          <FadeIn delay={0.1} className="lg:justify-self-end w-full">
            {children}
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
