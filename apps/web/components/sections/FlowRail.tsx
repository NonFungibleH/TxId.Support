"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

/**
 * The tracing rail for /how-it-works: a subtle vertical line that fills, with
 * a soft pulse riding it, as the visitor scrolls the stages. Centred on the
 * page on desktop (running down the gap between each stage's two columns) so
 * it reads as the spine of the flow; on mobile it stays left of the single
 * column. Replaces section dividers - the line IS the process.
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
      {/* Base rail - faint */}
      <div className="pointer-events-none absolute left-5 lg:left-1/2 top-2 bottom-2 w-px bg-[var(--border)]" />
      {/* Filled portion - quiet accent */}
      <motion.div
        style={{ height: fill }}
        className="pointer-events-none absolute left-5 lg:left-1/2 top-2 w-[2px] -translate-x-[0.5px] bg-gradient-to-b from-accent/30 via-accent to-accent shadow-[0_0_12px_rgba(99,102,241,0.35)]"
      />
      {/* The pulse riding the fill line */}
      <motion.div
        style={{ top: fill }}
        className="pointer-events-none absolute left-5 lg:left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <span className="block w-3 h-3 rounded-full bg-accent shadow-[0_0_20px_6px_rgba(99,102,241,0.5)]" />
      </motion.div>
      {children}
    </div>
  );
}
