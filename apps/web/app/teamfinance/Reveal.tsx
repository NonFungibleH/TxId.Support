"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper for the Team Finance landing page.
 *
 * Deliberately NOT framer-motion. This is a link-shared partner pitch page, so
 * the content must NEVER depend on JS to be visible: an earlier version wrapped
 * everything in a motion.div whose SSR output was `opacity:0`, so one hydration
 * hiccup (or JS disabled) rendered a blank page.
 *
 * Here the animation is a pure enhancement. The server and first client render
 * are `static` (no opacity/transform overrides), so content is visible with no
 * JS, on reduced-motion, and for anything already above the fold (which also
 * avoids a hide-then-show flash). Only elements that mount BELOW the fold are
 * hidden by JS and then revealed on scroll.
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
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    // Respect reduced-motion: leave everything visible.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Already in view at mount → stay visible, do not animate (no flash).
    if (el.getBoundingClientRect().top < vh - 80) return;
    setPhase("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dyn: CSSProperties =
    phase === "hidden"
      ? { opacity: 0, transform: "translateY(24px)" }
      : phase === "shown"
        ? {
            opacity: 1,
            transform: "none",
            transition: `opacity .5s ease ${delay}s, transform .5s ease ${delay}s`,
          }
        : {};

  return (
    <div ref={ref} style={{ ...style, ...dyn }}>
      {children}
    </div>
  );
}
