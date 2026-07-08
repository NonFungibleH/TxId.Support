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
      "Free plan: 150 conversations per month to evaluate the product, with wallet detection, transaction diagnostics, and docs Q&A. No credit card required.",
  },
  featureList: [
    "Automatic wallet detection (MetaMask, WalletConnect, Coinbase Wallet, Phantom)",
    "Failed transaction diagnostics (out of gas, reverts, custom errors, panics)",
    "Solidity revert-reason explainer",
    "Documentation and knowledge-base Q&A (RAG)",
    "Escalation to human support tickets",
    "White-label custom branding",
    "Telegram bot integration",
    "Multi-chain: Ethereum, Base, BNB Chain, Polygon, Arbitrum, Optimism",
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

// HowTo: the three-step embed. Matches "how do I add AI support to my
// protocol / DeFi site" queries that answer engines respond to with a
// step list, and mirrors the visible "Live in three steps" section.
export const howToEmbedSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to add an AI support agent to a Web3 protocol",
  description:
    "Embed the TxID Support AI agent on your DeFi protocol or token project site in three steps.",
  totalTime: "PT5M",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Embed",
      text: "Add one script tag to your site before the closing body tag. It works with React, Next.js, Vue, Svelte, or plain HTML, with no SDK to install and no build step.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Configure",
      text: "In the dashboard, set your brand colours, paste your logo URL, add your documentation link, and add your smart contract addresses. The preview updates in real time before you publish.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Go live",
      text: "Publish the widget. Your users get instant AI support: automatic wallet detection, failed-transaction diagnosis, and documentation Q&A, all in your own branding.",
    },
  ],
}

// DefinedTermSet: a glossary of why EVM transactions fail. This is prime
// GEO surface — answer engines pull short, factual definitions to answer
// "what does X mean" queries, and each term maps to a real search.
export const transactionGlossarySchema = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "Failed transaction glossary",
  description: "Plain-English definitions of the reasons a blockchain transaction fails.",
  hasDefinedTerm: [
    {
      "@type": "DefinedTerm",
      name: "Out of gas",
      description:
        "The transaction hit the gas limit set for it before the smart contract finished executing. It concerns the gas limit, not the wallet's ETH balance; the usual fix is to raise the gas limit and resubmit.",
    },
    {
      "@type": "DefinedTerm",
      name: "Gas limit",
      description:
        "The maximum units of computation a transaction is authorised to use. Setting it too low causes an out-of-gas failure; unused gas is refunded.",
    },
    {
      "@type": "DefinedTerm",
      name: "Revert reason",
      description:
        "A human-readable message a contract returns when a require() check fails, such as 'insufficient allowance', 'slippage', or 'expired'.",
    },
    {
      "@type": "DefinedTerm",
      name: "Custom error",
      description:
        "A gas-efficient contract error, for example SlippageTooHigh(), that appears as a raw hex selector on a block explorer unless the contract's ABI is known.",
    },
    {
      "@type": "DefinedTerm",
      name: "Panic",
      description:
        "An automatic Solidity error such as arithmetic overflow or underflow, division by zero, or an array index out of bounds, signalling the contract reached a state it did not expect.",
    },
    {
      "@type": "DefinedTerm",
      name: "Slippage",
      description:
        "A swap failure that occurs when the price moves beyond the tolerance you set between submitting and mining; the contract refuses to fill the trade at a worse price.",
    },
    {
      "@type": "DefinedTerm",
      name: "Pending or stuck transaction",
      description:
        "A transaction that has not failed but has not been mined, usually because the gas price was too low for current conditions or there is a nonce gap from an earlier unconfirmed transaction.",
    },
  ],
}
