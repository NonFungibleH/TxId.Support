"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

/**
 * The tracing rail for the Team Finance walkthrough — a light-themed version of
 * the site's FlowRail. A faint vertical line runs down the centre of the stages
 * (left of the single column on mobile) and fills in Team Finance blue, with a
 * soft pulse riding it, as the visitor scrolls. The line IS the process, so it
 * replaces section dividers and carries the "how it works" narrative.
 *
 * Purely decorative: framer-motion only drives the fill height, never content
 * visibility, so a JS failure just leaves a static faint line — nothing hides.
 */
export function Rail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.6", "end 0.8"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const fill = useTransform(progress, (v) => `${Math.min(100, Math.max(0, v * 100))}%`);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div className="tf-rail-line" aria-hidden="true" />
      <motion.div className="tf-rail-fill" aria-hidden="true" style={{ height: fill }} />
      <motion.div className="tf-rail-dot" aria-hidden="true" style={{ top: fill }}>
        <span />
      </motion.div>
      {children}
    </div>
  );
}
