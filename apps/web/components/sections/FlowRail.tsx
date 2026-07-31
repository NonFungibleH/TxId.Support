"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

/**
 * The tracing rail for /how-it-works: a vertical line down the page that
 * fills, with a glowing pulse riding it, as the visitor scrolls the stages.
 * Replaces the old section dividers - the line IS the process.
 */
export function FlowRail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.55", "end 0.75"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const fill = useTransform(progress, (v) => `${Math.min(100, Math.max(0, v * 100))}%`);

  return (
    <div ref={ref} className="relative">
      {/* Base rail */}
      <div className="pointer-events-none absolute left-5 lg:left-8 top-2 bottom-2 w-px bg-[var(--border)]" />
      {/* Filled portion */}
      <motion.div
        style={{ height: fill }}
        className="pointer-events-none absolute left-5 lg:left-8 top-2 w-px bg-gradient-to-b from-accent/30 via-accent to-accent"
      />
      {/* The pulse riding the fill line */}
      <motion.div
        style={{ top: fill }}
        className="pointer-events-none absolute left-5 lg:left-8 -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <span className="block w-3 h-3 rounded-full bg-accent shadow-[0_0_18px_6px_rgba(99,102,241,0.55)]" />
      </motion.div>
      {children}
    </div>
  );
}

/** A numbered node sitting ON the rail at each stage. */
export function FlowNode({ n }: { n: string }) {
  return (
    <span className="absolute left-5 lg:left-8 top-10 -translate-x-1/2 flex w-8 h-8 items-center justify-center rounded-full border border-accent/50 bg-[#0b0c14] font-mono text-[11px] text-accent z-10">
      {n}
    </span>
  );
}
