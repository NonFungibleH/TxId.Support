"use client"

import type { BrandingConfig } from "@/lib/types/config"
import { MessageCircleIcon, XIcon, SendIcon } from "lucide-react"

interface WidgetPreviewProps {
  branding: BrandingConfig
  projectName?: string
}

const FONT_CSS: Record<string, string> = {
  "Inter":          "'Inter', sans-serif",
  "Sora":           "'Sora', sans-serif",
  "Space Mono":     "'Space Mono', monospace",
  "DM Sans":        "'DM Sans', sans-serif",
  "IBM Plex Mono":  "'IBM Plex Mono', monospace",
  "Outfit":         "'Outfit', sans-serif",
}

export function WidgetPreview({
  branding,
  projectName = "Support",
}: WidgetPreviewProps) {
  const fontFamily = FONT_CSS[branding.font] ?? "'Inter', sans-serif"

  const positionClass =
    branding.position === "bottom-left"
      ? "items-end justify-start"
      : branding.position === "inline"
      ? "items-center justify-center"
      : "items-end justify-end"

  return (
    <div
      className={`relative flex h-[480px] w-full overflow-hidden rounded-xl border border-border bg-zinc-950 p-4 ${positionClass}`}
      aria-label="Widget preview"
    >
      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff10 1px, transparent 1px), linear-gradient(to bottom, #ffffff10 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Mock widget panel */}
      <div
        className="relative z-10 flex w-72 flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          backgroundColor: branding.backgroundColor,
          color: branding.textColor,
          fontFamily,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <div className="flex items-center gap-2">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="size-6 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex size-6 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: branding.secondaryColor, color: branding.textColor }}
              >
                {projectName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold" style={{ color: branding.textColor }}>
              {projectName}
            </span>
          </div>
          <XIcon className="size-4 opacity-70" style={{ color: branding.textColor }} />
        </div>

        {/* Messages area */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
          {/* Assistant bubble */}
          <div className="flex items-start gap-2">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: branding.primaryColor, color: branding.textColor }}
            >
              AI
            </div>
            <div
              className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed"
              style={{
                backgroundColor: branding.secondaryColor,
                color: branding.textColor,
              }}
            >
              Hi! I&apos;m here to help with questions about the protocol, token, and
              smart contracts. What would you like to know?
            </div>
          </div>

          {/* User bubble */}
          <div className="flex items-start justify-end gap-2">
            <div
              className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 text-xs leading-relaxed"
              style={{
                backgroundColor: branding.primaryColor,
                color: branding.textColor,
              }}
            >
              Is my token locked?
            </div>
          </div>

          {/* Assistant reply */}
          <div className="flex items-start gap-2">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: branding.primaryColor, color: branding.textColor }}
            >
              AI
            </div>
            <div
              className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed"
              style={{
                backgroundColor: branding.secondaryColor,
                color: branding.textColor,
              }}
            >
              I checked the Team Finance lock contract and your token appears to
              be locked until 2026. You can verify on the explorer.
            </div>
          </div>
        </div>

        {/* Input bar */}
        <div
          className="flex items-center gap-2 border-t px-3 py-2"
          style={{
            borderColor: `${branding.primaryColor}44`,
            backgroundColor: branding.backgroundColor,
          }}
        >
          <input
            readOnly
            placeholder="Ask anything…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-50"
            style={{ color: branding.textColor }}
          />
          <button
            className="flex size-6 items-center justify-center rounded-full"
            style={{ backgroundColor: branding.primaryColor }}
          >
            <SendIcon className="size-3" style={{ color: branding.textColor }} />
          </button>
        </div>
      </div>

      {/* FAB (shown when position is not inline) */}
      {branding.position !== "inline" && (
        <div className="absolute bottom-8 right-8 z-20">
          <button
            className="flex size-12 items-center justify-center rounded-full shadow-lg"
            style={{ backgroundColor: branding.primaryColor }}
          >
            <MessageCircleIcon className="size-5" style={{ color: branding.textColor }} />
          </button>
        </div>
      )}
    </div>
  )
}
