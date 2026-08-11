"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/**
 * Scroll-reveal wrapper for the Team Finance landing page.
 *
 * The page is a server component built almost entirely from inline styles, so
 * the shared FadeIn (className-only) could not carry its layout. This local
 * wrapper passes `style` straight through to a motion.div and fades content up
 * as it scrolls into view, matching the entrance motion used across the rest of
 * txid.support (same easing and distance as components/ui/FadeIn).
 */
export function Reveal({
  children,
  style,
  delay = 0,
}: {
  children: ReactNode;
  style?: CSSProperties;
  delay?: number;
}) {
  return (
    <motion.div
      style={style}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
