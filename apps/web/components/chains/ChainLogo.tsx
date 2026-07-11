"use client";

import { useState, useRef, useEffect } from "react";

interface ChainLogoProps {
  src: string;
  name: string;
  color: string;
  size?: number;
  className?: string;
}

/**
 * Chain logo with a graceful fallback: if the image is missing (e.g. the
 * official Stellar/TON/Aptos logos haven't been dropped in yet), we render a
 * monogram badge in the chain's colour instead of a broken image.
 */
export function ChainLogo({ src, name, color, size = 40, className }: ChainLogoProps) {
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
          borderRadius: size * 0.28,
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  );
}
