"use client";

import { useState, useRef, useEffect } from "react";

interface ChainLogoProps {
  src: string;
  name: string;
  color: string;
  size?: number;
  className?: string;
  /** Render the mark on a white disc (for logos that vanish on dark). */
  whiteBg?: boolean;
}

/**
 * Chain logo normalised to a uniform circular badge. The source PNGs are all
 * different shapes (yellow tile, transparent diamond, flat square), so every
 * mark is clipped to the same circle; `whiteBg` adds a white disc + inset for
 * marks that need it (matches the homepage hero treatment). Falls back to a
 * monogram disc in the chain's colour if the image is missing.
 */
export function ChainLogo({ src, name, color, size = 40, className, whiteBg }: ChainLogoProps) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // The onError event can fire before React hydrates and attaches its handler
  // (SSR race), so also check on mount: a finished load with zero natural width
  // means the image 404'd.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: size * 0.42,
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label={name}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...(whiteBg ? { background: "#fff", padding: size * 0.12 } : {}),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </span>
  );
}
