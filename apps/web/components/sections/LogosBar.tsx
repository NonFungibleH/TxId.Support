import { FadeIn } from "@/components/ui/FadeIn";

const LOGOS = [
  "Protocol Alpha",
  "DeFi Beta",
  "Chain Gamma",
  "Swap Delta",
  "Vault Epsilon",
];

export function LogosBar() {
  return (
    <section className="py-16 border-y border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <p className="text-center text-xs font-mono text-muted uppercase tracking-widest mb-8">
            Trusted by DeFi protocols
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {LOGOS.map((name) => (
              <div
                key={name}
                className="h-7 flex items-center px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
              >
                <span className="font-mono text-xs text-muted">{name}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
