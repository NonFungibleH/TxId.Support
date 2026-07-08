import Link from "next/link";
import { ArrowRight, Braces, Plug, Bot } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const ITEMS = [
  { icon: Braces, label: "Diagnostics API" },
  { icon: Plug, label: "MCP server" },
  { icon: Bot, label: "Headless answers" },
];

export function PlatformTeaser() {
  return (
    <section className="py-16">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <Link
            href="/platform"
            className="block bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 lg:p-10 hover:border-[var(--border-accent)] transition-colors group relative overflow-hidden"
          >
            <div
              className="absolute -top-24 -right-24 w-[360px] h-[360px] rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <p className="font-mono text-sm text-accent">{`Platform`}</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-accent/40 bg-accent/10 font-mono text-[11px] text-accent">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    Coming soon
                  </span>
                </div>
                <h2 className="font-display text-3xl font-bold text-white mb-3">
                  The same engine, as an API and MCP server
                </h2>
                <p className="text-muted max-w-xl text-sm leading-relaxed">
                  Everything the widget can diagnose, available headless: for your
                  support desk, your own product, or any MCP-compatible AI tooling.
                </p>
              </div>

              <div className="flex flex-col gap-3 shrink-0">
                {ITEMS.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-accent" />
                    </div>
                    <span className="text-sm text-white/90">{item.label}</span>
                  </div>
                ))}
                <span className="inline-flex items-center gap-1.5 text-sm text-accent font-medium mt-2 group-hover:gap-2.5 transition-all">
                  Learn more
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
