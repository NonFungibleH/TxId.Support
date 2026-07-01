"use server"

import { auth } from "@clerk/nextjs/server"
import { isPrivateUrl } from "@/lib/security"

// ── Colour utilities ─────────────────────────────────────────────────────────

function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim())
}

function normalizeHex(hex: string): string {
  const clean = hex.trim().replace("#", "")
  if (clean.length === 3) {
    return "#" + clean.split("").map(c => c + c).join("")
  }
  return "#" + clean.slice(0, 6).toLowerCase()
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").slice(0, 6)
  if (clean.length !== 6) return null
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const [r, g, b] = rgb.map(c => Math.max(0, Math.floor(c * (1 - amount))))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.5
}

function isNearBlack(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 < 0.08
}

function isNearWhite(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 > 0.92
}

// ── CSS scanning helpers ──────────────────────────────────────────────────────

const CSS_VAR_CANDIDATES = [
  "--primary-color", "--brand-color", "--accent-color", "--color-primary",
  "--primary", "--brand", "--accent", "--theme-color", "--main-color",
  "--color-brand", "--color-accent",
]

function extractPrimaryFromCss(cssText: string): string | undefined {
  for (const v of CSS_VAR_CANDIDATES) {
    const escaped = v.replace(/[-]/g, "\\-")
    const match = cssText.match(new RegExp(`${escaped}\\s*:\\s*(#[0-9a-fA-F]{3,8})`, "i"))
    if (match?.[1] && isValidHex(match[1]) && !isNearBlack(match[1]) && !isNearWhite(match[1])) {
      return normalizeHex(match[1])
    }
  }
}

function extractBgFromCss(cssText: string): string | undefined {
  const m = cssText.match(/body\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i)
  if (m?.[1] && isValidHex(m[1])) return normalizeHex(m[1])
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface BrandColorResult {
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  textColor?: string
  foundSignals: string[]
  error?: string
}

export async function fetchBrandColors(rawUrl: string): Promise<BrandColorResult> {
  const { userId } = await auth()
  if (!userId) return { foundSignals: [], error: "Unauthenticated" }

  try {
    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`

    if (isPrivateUrl(url)) {
      return { foundSignals: [], error: "Invalid URL" }
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TxIDSupport/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    })

    if (!response.ok) {
      return { foundSignals: [], error: `Could not reach ${url} (HTTP ${response.status})` }
    }

    const html = await response.text()
    const foundSignals: string[] = []
    let primaryColor: string | undefined
    let backgroundColor: string | undefined

    // Detect explicit dark-theme signals upfront
    const hasDarkColorScheme =
      /<meta[^>]*name=["']color-scheme["'][^>]*content=["'][^"']*dark/i.test(html) ||
      /color-scheme\s*:\s*dark(?:\s|;|")/i.test(html)
    const hasDarkBodyClass =
      /<(?:html|body)[^>]*class=["'][^"']*\bdark\b/i.test(html) ||
      /<(?:html|body)[^>]*data-theme=["']dark["']/i.test(html)

    // 0. body/html inline style background — most direct signal
    if (!backgroundColor) {
      const bodyStyleBg =
        html.match(/<(?:body|html)[^>]+style=["'][^"']*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i)
      if (bodyStyleBg?.[1] && isValidHex(bodyStyleBg[1])) {
        backgroundColor = normalizeHex(bodyStyleBg[1])
        foundSignals.push("body/html style background")
      }
    }

    // 1. <meta name="theme-color"> — most reliable primary signal
    const themeColorMatch =
      html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i)

    if (themeColorMatch?.[1]) {
      const val = themeColorMatch[1].trim()
      if (isValidHex(val) && !isNearBlack(val) && !isNearWhite(val)) {
        primaryColor = normalizeHex(val)
        foundSignals.push("theme-color meta")
      }
    }

    // 2. Web app manifest — theme_color + background_color
    if (!primaryColor || !backgroundColor) {
      const manifestMatch =
        html.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i) ||
        html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']manifest["']/i)

      if (manifestMatch?.[1]) {
        try {
          const manifestUrl = new URL(manifestMatch[1], url).href
          if (isPrivateUrl(manifestUrl)) throw new Error("blocked")
          const mRes = await fetch(manifestUrl, { signal: AbortSignal.timeout(3000) })
          if (mRes.ok) {
            const manifest = (await mRes.json()) as { theme_color?: string; background_color?: string }
            if (!primaryColor && manifest.theme_color && isValidHex(manifest.theme_color)
              && !isNearBlack(manifest.theme_color) && !isNearWhite(manifest.theme_color)) {
              primaryColor = normalizeHex(manifest.theme_color)
              foundSignals.push("manifest theme_color")
            }
            if (!backgroundColor && manifest.background_color && isValidHex(manifest.background_color)) {
              backgroundColor = normalizeHex(manifest.background_color)
              foundSignals.push("manifest background_color")
            }
          }
        } catch {
          // non-fatal
        }
      }
    }

    // 3. CSS custom properties in inline <style> blocks
    if (!primaryColor) {
      const styleContent = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
        .map(m => m[1])
        .join("\n")

      const found = extractPrimaryFromCss(styleContent)
      if (found) {
        primaryColor = found
        foundSignals.push("CSS var in inline style")
      }

      if (!backgroundColor) {
        const bg = extractBgFromCss(styleContent)
        if (bg) { backgroundColor = bg; foundSignals.push("body background-color") }
      }
    }

    // 4. External stylesheets — most modern sites put CSS variables here
    if (!primaryColor) {
      const sheetMatches = [...html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)]
      const sheetUrls = sheetMatches
        .map(m => { try { return new URL(m[1], url).href } catch { return null } })
        .filter((u): u is string => u !== null && !isPrivateUrl(u))
        .slice(0, 4)

      for (const sheetUrl of sheetUrls) {
        try {
          const res = await fetch(sheetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; TxIDSupport/1.0)" },
            signal: AbortSignal.timeout(4000),
          })
          if (!res.ok) continue
          const cssText = await res.text()
          const found = extractPrimaryFromCss(cssText)
          if (found) {
            primaryColor = found
            foundSignals.push("CSS var in external stylesheet")
            if (!backgroundColor) {
              const bg = extractBgFromCss(cssText)
              if (bg) { backgroundColor = bg; foundSignals.push("body bg in external stylesheet") }
            }
            break
          }
        } catch {
          // non-fatal
        }
      }
    }

    if (!primaryColor) {
      return {
        foundSignals,
        error: "No brand colour found. Try a different URL, or enter colours manually.",
      }
    }

    // Background: use detected value, or infer from explicit dark signals.
    // Default to white — most marketing/B2B sites are light-themed even when their
    // brand colour is a dark/saturated hue.
    const explicitlyDark = hasDarkColorScheme || hasDarkBodyClass ||
      (backgroundColor != null && !isLight(backgroundColor))
    const bg = backgroundColor ?? (explicitlyDark ? "#0f0f0f" : "#ffffff")
    const secondary = darken(primaryColor, 0.2)
    const text = isLight(bg) ? "#111827" : "#ffffff"

    return {
      primaryColor,
      secondaryColor: secondary,
      backgroundColor: bg,
      textColor: text,
      foundSignals,
    }
  } catch (err) {
    return {
      foundSignals: [],
      error: err instanceof Error ? `Failed: ${err.message}` : "Unknown error",
    }
  }
}
