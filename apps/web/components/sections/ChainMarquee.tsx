import Link from "next/link";
import { VISIBLE_CHAINS } from "@/lib/chains";

/**
 * Every chain TxID reads, scrolling.
 *
 * This replaced a wrapped wall of 20 tiny badges in the hero. At six chains
 * that strip read as a proof point; at twenty it read as clutter, and the
 * marks were too small to recognise. The count now makes the claim and this
 * band shows the evidence at a size where a logo is actually identifiable.
 *
 * DERIVED from the same list as /chains, never hand-maintained. The hero strip
 * this replaces was originally a second list and was missing Robinhood Chain
 * within an hour of it going live.
 *
 * LayerZero is included here and NOT in the count, deliberately. It is a
 * message layer that runs across the others rather than somewhere the product
 * is "available on", so counting it would overstate the chain number, and
 * omitting its mark would hide something we genuinely read.
 */
const MARQUEE_CHAINS = VISIBLE_CHAINS.filter((c) => c.status === "live");
export const LIVE_CHAIN_COUNT = MARQUEE_CHAINS.filter((c) => c.family !== "cross-chain").length;

/** Seconds per chain, so adding one lengthens the loop instead of speeding it up. */
const SECONDS_PER_CHAIN = 3.2;

function Mark({ name, logo, color, whiteBg }: { name: string; logo?: string; color: string; whiteBg?: boolean }) {
  return (
    <span
      className="flex items-center gap-2.5 px-5 shrink-0"
      title={name}
    >
      <span
        className={[
          "h-8 w-8 shrink-0 rounded-full flex items-center justify-center",
          whiteBg ? "bg-white p-[3px]" : "overflow-hidden",
        ].join(" ")}
        style={logo ? undefined : { background: color }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" aria-hidden="true" className="w-full h-full object-contain" />
        ) : (
          <span className="text-[13px] font-semibold text-black/80">{name.charAt(0)}</span>
        )}
      </span>
      <span className="text-sm text-muted whitespace-nowrap">{name}</span>
    </span>
  );
}

/**
 * No opacity modifier on the theme colours here, and no background fill.
 * Tailwind's `/60` cannot apply to a raw `var()` colour, so `border-border/60`
 * silently resolved to Tailwind's DEFAULT light grey and drew pale lines across
 * a dark page, and `bg-surface/30` produced nothing at all. `--border` already
 * carries its own alpha. Leaving the band on the page's own background is also
 * what lets the edge fades below match it exactly.
 */
export function ChainMarquee() {
  // The track is rendered twice; the animation shifts it by exactly half.
  const track = (
    <div className="flex items-center py-1" aria-hidden="true">
      {MARQUEE_CHAINS.map((c) => (
        <Mark key={c.slug} name={c.name} logo={c.logo} color={c.color} whiteBg={c.logoWhiteBg} />
      ))}
    </div>
  );

  return (
    <section className="border-y border-border py-5 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-3.5 flex items-baseline justify-between gap-4">
        <p className="text-xs font-mono text-muted/60">
          Reading {LIVE_CHAIN_COUNT} chains, plus LayerZero
        </p>
        <Link
          href="/chains"
          className="text-xs text-muted/60 hover:text-accent transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded"
        >
          See what we diagnose on each
        </Link>
      </div>

      <div
        className="chain-marquee relative"
        style={{ ["--marquee-duration" as string]: `${(MARQUEE_CHAINS.length * SECONDS_PER_CHAIN).toFixed(0)}s` }}
      >
        {/* Fades so marks enter and leave rather than being cut off at the edge. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-[var(--bg-base)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-[var(--bg-base)] to-transparent" />
        <div className="chain-marquee-track">
          {track}
          {track}
        </div>
      </div>

      {/* The marks are decorative duplicates; this is what a screen reader gets. */}
      <p className="sr-only">
        TxID reads {MARQUEE_CHAINS.map((c) => c.name).join(", ")}.
      </p>
    </section>
  );
}
