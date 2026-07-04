import type { MetadataRoute } from "next"

// AI answer-engine crawlers we explicitly welcome — for GEO we WANT these
// indexing the marketing site so ChatGPT, Perplexity, Claude, and Google AI
// Overviews can cite TxID Support accurately. Listed alongside the catch-all
// so the intent is unambiguous to crawlers that look for a named rule.
const AI_CRAWLERS = [
  "GPTBot",            // OpenAI / ChatGPT
  "OAI-SearchBot",     // OpenAI search
  "ChatGPT-User",      // ChatGPT browsing
  "PerplexityBot",     // Perplexity
  "Perplexity-User",   // Perplexity browsing
  "ClaudeBot",         // Anthropic
  "Claude-Web",        // Anthropic browsing
  "Google-Extended",   // Google Gemini / AI Overviews
  "Applebot-Extended", // Apple Intelligence
  "Bytespider",        // TikTok / ByteDance
  "CCBot",             // Common Crawl (feeds many LLMs)
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: "https://txid.support/sitemap.xml",
    host: "https://txid.support",
  }
}
