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

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("")
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")
}

// oklch is used by Tailwind v4 / shadcn v2. Approximate by mapping to HSL using the hue channel.
function oklchApproxHex(l: number, c: number, h: number): string | null {
  if (c < 0.02) return null // achromatic — no useful hue
  const approxL = Math.min(95, Math.max(5, l * 100))
  const approxS = Math.min(100, c * 280)
  return hslToHex(h, approxS, approxL)
}

const CSS_VAR_CANDIDATES = [
  "--primary-color", "--brand-color", "--accent-color", "--color-primary",
  "--primary", "--brand", "--accent", "--theme-color", "--main-color",
  "--color-brand", "--color-accent", "--highlight-color", "--cta-color",
  "--link-color", "--button-color", "--hero-color",
]

function extractPrimaryFromCss(cssText: string): string | undefined {
  for (const v of CSS_VAR_CANDIDATES) {
    const esc = v.replace(/[-]/g, "\\-")

    // Hex: --primary: #6366f1
    const hex = cssText.match(new RegExp(`${esc}\\s*:\\s*(#[0-9a-fA-F]{3,8})`, "i"))
    if (hex?.[1] && isValidHex(hex[1]) && !isNearBlack(hex[1]) && !isNearWhite(hex[1])) {
      return normalizeHex(hex[1])
    }

    // rgb()/rgba(): --primary: rgb(99, 102, 241)
    const rgb = cssText.match(new RegExp(`${esc}\\s*:\\s*rgba?\\(\\s*(\\d+)\\s*[,\\s]\\s*(\\d+)\\s*[,\\s]\\s*(\\d+)`, "i"))
    if (rgb) {
      const c = rgbToHex(+rgb[1], +rgb[2], +rgb[3])
      if (!isNearBlack(c) && !isNearWhite(c)) return c
    }

    // hsl()/hsla(): --primary: hsl(239, 84%, 67%)  or  hsl(239deg 84% 67%)
    const hsl = cssText.match(new RegExp(`${esc}\\s*:\\s*hsla?\\(\\s*(\\d+(?:\\.\\d+)?)(?:deg)?\\s*[,\\s]\\s*(\\d+(?:\\.\\d+)?)%\\s*[,\\s]\\s*(\\d+(?:\\.\\d+)?)%`, "i"))
    if (hsl) {
      const c = hslToHex(+hsl[1], +hsl[2], +hsl[3])
      if (!isNearBlack(c) && !isNearWhite(c)) return c
    }

    // shadcn/ui raw HSL triplet: --primary: 239 84% 67%
    const rawHsl = cssText.match(new RegExp(`${esc}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`, "i"))
    if (rawHsl) {
      const c = hslToHex(+rawHsl[1], +rawHsl[2], +rawHsl[3])
      if (!isNearBlack(c) && !isNearWhite(c)) return c
    }

    // oklch(): --primary: oklch(0.65 0.2 264)  (Tailwind v4 / shadcn v2)
    const oklch = cssText.match(new RegExp(`${esc}\\s*:\\s*oklch\\(\\s*(\\d+(?:\\.\\d+)?)%?\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)`, "i"))
    if (oklch) {
      const lRaw = +oklch[1]; const c2 = +oklch[2]; const h2 = +oklch[3]
      const lNorm = lRaw > 1 ? lRaw / 100 : lRaw
      const approx = oklchApproxHex(lNorm, c2, h2)
      if (approx && !isNearBlack(approx) && !isNearWhite(approx)) return approx
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
        .slice(0, 6)

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

    // 5. Tailwind arbitrary color classes: bg-[#6366f1] text-[#6366f1] etc.
    if (!primaryColor) {
      const tailwindMatches = [...html.matchAll(/(?:bg|text|border|ring|fill|stroke)-\[#([0-9a-fA-F]{3,8})\]/g)]
      const freq = new Map<string, number>()
      for (const m of tailwindMatches) {
        const c = "#" + m[1]
        if (isValidHex(c) && !isNearBlack(c) && !isNearWhite(c)) {
          freq.set(c, (freq.get(c) ?? 0) + 1)
        }
      }
      if (freq.size > 0) {
        const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
        primaryColor = normalizeHex(top)
        foundSignals.push("Tailwind arbitrary color class")
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
