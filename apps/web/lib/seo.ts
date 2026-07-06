// Structured-data (JSON-LD) builders. Shared across pages so schema stays
// consistent. These help two audiences at once:
//   - Search engines: rich results (org logo, sitelinks, FAQ accordions)
//   - Generative engines (ChatGPT, Perplexity, Google AI Overviews): a clean,
//     machine-readable description they can cite accurately.

export const SITE_URL = "https://txid.support"
export const SITE_NAME = "TxID Support"

const DESCRIPTION =
  "White-label AI support agent for DeFi protocols and Web3 token projects. Auto-detects the user's connected wallet, diagnoses failed transactions, answers questions from your docs, and escalates to your team. Embed with one script tag."

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  description: DESCRIPTION,
}

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
}

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description:
      "Free plan: 1,000 conversations per month, wallet detection, transaction diagnostics, and docs Q&A. No credit card required.",
  },
  featureList: [
    "Automatic wallet detection (MetaMask, WalletConnect, Coinbase Wallet, Phantom)",
    "Failed transaction diagnostics (out of gas, reverts, custom errors, panics)",
    "Solidity revert-reason explainer",
    "Documentation and knowledge-base Q&A (RAG)",
    "Escalation to human support tickets",
    "White-label custom branding",
    "Telegram bot integration",
    "Multi-chain: Ethereum, Solana, Base, BNB Chain, Polygon, Arbitrum, Optimism",
    "One script-tag embed, works with any stack",
  ],
}

export function faqPageSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}
