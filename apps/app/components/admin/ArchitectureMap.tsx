import {
  STACK, SCHEDULED, HONEST_GAPS, MATURITY, STATUS_LABEL, type NodeStatus,
} from "@/lib/architecture"

/**
 * The whole stack, presented as a published page rather than a dashboard view.
 *
 * DELIBERATELY THE MARKETING BRAND, NOT THE DASHBOARD'S: this is a reference
 * document, and the one thing most likely to be screen-shared with a partner.
 * The tokens are scoped to this page so it looks the same whatever theme the
 * dashboard is in, which also means a screenshot is never half dark and half
 * light.
 *
 * Laid out on a spine because the stages are SEQUENTIAL. A grid of equal cards
 * says "nine things"; the point is that a question travels through them.
 */

/** Marketing palette, from apps/web/app/globals.css. Kept in sync by hand. */
const TOKENS = `
.txid-arch {
  --bg-base: #0b0c14;
  --bg-surface: #0f1020;
  --bg-elevated: #151728;
  --accent: #6366f1;
  --accent-muted: rgba(99, 102, 241, 0.12);
  --text-primary: #f0f0ff;
  --text-muted: #6b7280;
  --line: rgba(255, 255, 255, 0.07);
  --green: #22c55e;
  --yellow: #f59e0b;
  --red: #ef4444;
  color: var(--text-primary);
  font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}
.txid-arch ::selection { background: var(--accent-muted); }
`

const HUE: Record<NodeStatus, string> = {
  live: "var(--accent)",
  optional: "var(--yellow)",
  aptos: "var(--green)",
  planned: "var(--red)",
  paused: "var(--text-muted)",
}

const SHORT: Record<string, string> = {
  surfaces: "Surfaces",
  isolation: "Isolation",
  ingress: "Gates",
  context: "Context",
  intelligence: "Investigate",
  verification: "Verify",
  record: "Record",
  human: "Handover",
  governance: "Governance",
  insight: "Insight",
}

function Eyebrow({ children, hue }: { children: React.ReactNode; hue?: string }) {
  return (
    <p
      className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: hue ?? "var(--accent)" }}
    >
      {children}
    </p>
  )
}

export function ArchitectureMap() {
  return (
    <div className="txid-arch rounded-2xl" style={{ background: "var(--bg-base)" }}>
      <style>{TOKENS}</style>

      <div className="mx-auto max-w-5xl px-6 py-12 md:px-10 md:py-16">
        {/* Masthead */}
        <header className="border-b pb-10" style={{ borderColor: "var(--line)" }}>
          <Eyebrow>Internal reference</Eyebrow>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
            How the system fits together
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Every layer, in the order a question travels through it. Written as data beside the
            code rather than drawn, so it changes when the system does and anything stale shows up
            as a diff rather than as a surprise in front of a partner.
          </p>
        </header>

        {/* How far along any of this actually is. Read before the detail,
            because it changes how the detail should be read. */}
        <section className="border-b py-10" style={{ borderColor: "var(--line)" }}>
          <Eyebrow>How far along</Eyebrow>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Built and proven are not the same thing, and an institutional reader hears the second
            when you say the first. Most of what is on this page is between the first two rungs.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {MATURITY.map((m, i) => (
              <div
                key={m.stage}
                className="rounded-xl border p-4"
                style={{
                  borderColor: i === 3 ? "color-mix(in srgb, var(--red) 25%, transparent)" : "var(--line)",
                  background: "var(--bg-surface)",
                }}
              >
                <p className="flex items-baseline gap-2 text-sm font-semibold">
                  <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {i + 1}
                  </span>
                  {m.stage}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {m.meaning}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)", opacity: 0.75 }}>
                  {m.where}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* The shape, before any detail */}
        <section className="py-10">
          <Eyebrow>A question, end to end</Eyebrow>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {STACK.map((layer, i) => (
              <span key={layer.id} className="flex items-center gap-1.5">
                <a
                  href={`#${layer.id}`}
                  className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
                  style={{ borderColor: "var(--line)", background: "var(--bg-surface)" }}
                >
                  {SHORT[layer.id] ?? layer.title}
                </a>
                {i < STACK.length - 1 && (
                  <span style={{ color: "var(--text-muted)" }} aria-hidden="true">→</span>
                )}
              </span>
            ))}
          </div>

          <div
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t pt-5"
            style={{ borderColor: "var(--line)" }}
          >
            {(Object.keys(HUE) as NodeStatus[]).map(s => (
              <span key={s} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="size-1.5 rounded-full" style={{ background: HUE[s] }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </section>

        {/* Spine */}
        <div className="relative">
          <div
            className="absolute bottom-8 left-[17px] top-2 w-px"
            style={{ background: "linear-gradient(to bottom, var(--accent), var(--line), transparent)" }}
            aria-hidden="true"
          />

          <div className="space-y-14">
            {STACK.map((layer, i) => (
              <section key={layer.id} id={layer.id} className="relative scroll-mt-8 pl-14">
                <span
                  className="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border font-mono text-[11px]"
                  style={{
                    borderColor: "var(--line)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-muted)",
                  }}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <h2 className="text-2xl font-bold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
                  {layer.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {layer.purpose}
                </p>

                <div className="mt-5 grid gap-2.5 md:grid-cols-2">
                  {layer.nodes.map(n => (
                    <div
                      key={n.name}
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: n.status === "live" ? "var(--line)" : `color-mix(in srgb, ${HUE[n.status]} 25%, transparent)`,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="flex items-baseline gap-2.5 text-sm font-semibold">
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: HUE[n.status] }}
                          />
                          {n.name}
                        </p>
                        {n.status !== "live" && (
                          <span
                            className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: HUE[n.status] }}
                          >
                            {STATUS_LABEL[n.status]}
                          </span>
                        )}
                      </div>
                      <p
                        className="mt-2 pl-4 text-[13px] leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {n.detail}
                      </p>
                      {n.where && (
                        <p
                          className="mt-2.5 break-all pl-4 font-mono text-[10px]"
                          style={{ color: "var(--text-muted)", opacity: 0.6 }}
                        >
                          {n.where}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Scheduled */}
        <section className="mt-16 border-t pt-12" style={{ borderColor: "var(--line)" }}>
          <Eyebrow>Runs on its own</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            Scheduled work
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Driven from <span className="font-mono text-xs">.github/workflows/cron.yml</span> rather
            than Vercel Cron, because the Hobby plan allows one run per day and a retry worker needs
            minutes.
          </p>
          <div className="mt-5 space-y-2.5">
            {SCHEDULED.map(j => (
              <div
                key={j.path}
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--line)", background: "var(--bg-surface)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-mono text-[13px]" style={{ color: "var(--accent)" }}>{j.path}</p>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {j.cadence}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {j.what}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Gaps */}
        <section className="mt-16 border-t pt-12" style={{ borderColor: "var(--line)" }}>
          <Eyebrow hue="var(--red)">Stated plainly</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            What is not built
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            The same honesty the record is for. These are the things a buyer would reasonably assume
            exist and would be wrong.
          </p>
          <div className="mt-5 grid gap-2.5 md:grid-cols-2">
            {HONEST_GAPS.map(g => (
              <div
                key={g.title}
                className="rounded-xl border p-4"
                style={{
                  borderColor: "color-mix(in srgb, var(--red) 22%, transparent)",
                  background: "var(--bg-surface)",
                }}
              >
                <p className="text-sm font-semibold">{g.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {g.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
