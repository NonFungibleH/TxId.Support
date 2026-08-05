export type DocCategory = "getting-started" | "configuration" | "features" | "data"

export const DOC_CATEGORIES: Record<DocCategory, { label: string; order: number }> = {
  "getting-started": { label: "Getting Started", order: 0 },
  "configuration":   { label: "Configuration",   order: 1 },
  "features":        { label: "Features",         order: 2 },
  "data":            { label: "Data & Insights",  order: 3 },
}

export type DocSection =
  | { type: "p";       text: string }
  | { type: "h2";      text: string }
  | { type: "h3";      text: string }
  | { type: "ul";      items: string[] }
  | { type: "ol";      items: string[] }
  | { type: "callout"; variant: "info" | "tip" | "warning"; title?: string; text: string }
  | { type: "code";    lang?: string; text: string }
  | { type: "grid";    items: Array<{ title: string; description: string }> }
  | { type: "steps";   items: Array<{ title: string; description: string }> }
  // A scannable capability table. Status is required on every row so nothing
  // can be listed without saying whether it actually exists yet.
  | { type: "features"; items: Array<{
      feature: string
      detail: string
      status: "available" | "optional" | "coming" | "paused"
    }> }

export interface Doc {
  slug: string
  title: string
  description: string
  category: DocCategory
  order: number
  content: DocSection[]
}

export const DOCS: Doc[] = [
  {
    slug: "features",
    title: "Feature list",
    description: "Everything TxID does, with what is and is not built yet",
    category: "features",
    order: -1,
    content: [
      { type: "p", text: "Everything TxID does, in one place. Each row carries a status: Available means it is in production today, Optional means it is off unless you turn it on, Coming means it is on the roadmap and not built, and Paused means it is built but hidden for now." },
      { type: "callout", variant: "info", title: "Why the statuses matter", text: "A feature list is exactly where an overstated \"available\" costs the most. Anything marked Coming is genuinely not built, and we would rather tell you that here than have you discover it during an evaluation." },

      { type: "h2", text: "Deployment surfaces" },
      { type: "features", items: [
        { feature: "Embedded widget", detail: "One script tag. Works with React, Next.js, Vue, Svelte or plain HTML.", status: "available" },
        { feature: "Inline embed", detail: "Render inside a container instead of a floating button.", status: "available" },
        { feature: "React component", detail: "@txid/react for direct integration.", status: "available" },
        { feature: "Telegram bot", detail: "One bot per protocol, connected with a BotFather token.", status: "available" },
        { feature: "REST API", detail: "Server to server, authenticated with your secret key.", status: "available" },
        { feature: "MCP server", detail: "On-chain diagnostics as tools for MCP-compatible AI clients.", status: "coming" },
      ]},

      { type: "h2", text: "Transaction diagnostics" },
      { type: "features", items: [
        { feature: "Failure diagnosis", detail: "Replays the transaction and explains the cause.", status: "available" },
        { feature: "Revert reasons", detail: "require() strings decoded and translated into plain English.", status: "available" },
        { feature: "Custom errors", detail: "Solidity custom errors decoded via your ABI or 4byte.directory.", status: "available" },
        { feature: "Solidity panics", detail: "Overflow, division by zero, array bounds, failed assert.", status: "available" },
        { feature: "Out of gas", detail: "Detected from gas used against the limit, with no extra RPC call.", status: "available" },
        { feature: "Move aborts", detail: "Aptos abort codes decoded against framework and protocol error maps.", status: "available" },
        { feature: "Stuck and pending", detail: "Nonce gaps and underpriced transactions identified as such.", status: "available" },
        { feature: "Error glossary", detail: "Your own explanation per contract error, used verbatim.", status: "available" },
      ]},

      { type: "h2", text: "Wallet and account intelligence" },
      { type: "features", items: [
        { feature: "Wallet detection", detail: "MetaMask, WalletConnect, Coinbase Wallet, Petra, Martian.", status: "available" },
        { feature: "Address paste", detail: "Answers without connecting a wallet at all.", status: "available" },
        { feature: "Proactive opener", detail: "On connect, leads with what is actually happening: a failed transaction is diagnosed rather than offered. Silent when a lookup fails.", status: "available" },
        { feature: "First-transaction help", detail: "A wallet that has never used the protocol gets set-up help instead of a support prompt.", status: "available" },
        { feature: "Balances", detail: "Native, ERC-20, and Aptos fungible assets.", status: "available" },
        { feature: "Transaction history", detail: "Recent activity, scoped to your contracts where useful.", status: "available" },
        { feature: "Token approvals", detail: "Open allowances, including unlimited grants. EVM only.", status: "available" },
        { feature: "Name resolution", detail: "ENS on EVM, Aptos Name Service on Aptos.", status: "available" },
        { feature: "Sub accounts", detail: "Resolves a wallet to the protocol's own account object, so delegated-trading balances are never reported as empty.", status: "optional" },
        { feature: "Two-address display", detail: "Shows wallet and sub account together on connect, labelled, both available in full to copy.", status: "optional" },
        { feature: "Merged history", detail: "Wallet and protocol-account activity combined, each labelled with where it came from.", status: "available" },
      ]},

      { type: "h2", text: "Contract and token intelligence" },
      { type: "features", items: [
        { feature: "Contract verification", detail: "Source-verified status, proxy configuration, upgrade history.", status: "available" },
        { feature: "Live contract state", detail: "Read from the chain at question time, not from a cache.", status: "available" },
        { feature: "Contract events", detail: "Indexed on EVM. On Aptos, recovered by scanning a stated window.", status: "available" },
        { feature: "Move module ABIs", detail: "Read on-chain, so there is nothing to upload.", status: "available" },
        { feature: "Token information", detail: "Supply, decimals, live DEX price, allowances.", status: "available" },
        { feature: "Token safety", detail: "Honeypot and fee-on-transfer signals. EVM only.", status: "available" },
        { feature: "Network status", detail: "Gas conditions, fee guidance, node responsiveness.", status: "available" },
      ]},

      { type: "h2", text: "Protocol-aware answers" },
      { type: "p", text: "Configured per protocol. The set below is what a perpetuals venue exposes, and shows the depth available when a protocol's own views are wired in." },
      { type: "features", items: [
        { feature: "Positions and collateral", detail: "Size, side, entry, leverage and margin mode, in dollars and units.", status: "available" },
        { feature: "Unrealised PnL", detail: "Live oracle price against entry, per position.", status: "available" },
        { feature: "Liquidation risk", detail: "The contract's own liquidation check, plus equity against the threshold.", status: "available" },
        { feature: "Order constraints", detail: "Minimum size, size increment, maximum leverage, market open state.", status: "available" },
        { feature: "Pending orders", detail: "Accepted but not yet matched, across every market.", status: "available" },
        { feature: "Pending withdrawals", detail: "Answers \"where is my withdrawal?\" from the queue itself.", status: "available" },
        { feature: "Funding and stops", detail: "Complete funding cost, and whether a stop or take profit is set.", status: "available" },
      ]},

      { type: "h2", text: "Knowledge" },
      { type: "features", items: [
        { feature: "Documentation indexing", detail: "Crawls your docs and answers from them.", status: "available" },
        { feature: "Source citations", detail: "Links the page an answer came from. Cites nothing when the answer came from chain data instead.", status: "available" },
        { feature: "Automatic re-sync", detail: "Re-checks your docs daily or weekly and re-indexes only pages that changed.", status: "optional" },
        { feature: "Deleted pages pruned", detail: "A page you remove stops being answered from, instead of lingering forever.", status: "available" },
        { feature: "Re-sync on docs commit", detail: "Trigger a re-check from a webhook when your docs repo changes.", status: "coming" },
        { feature: "Grounded answers", detail: "Says so when something cannot be verified, rather than guessing.", status: "available" },
        { feature: "Content blocks", detail: "Fixed answers for questions you want worded exactly.", status: "available" },
        { feature: "Languages", detail: "16 supported, or auto-detected from the user.", status: "available" },
      ]},

      { type: "h2", text: "The case record" },
      { type: "features", items: [
        { feature: "Full investigation", detail: "Question, evidence, reasoning and resolution, not just a transcript.", status: "available" },
        { feature: "Summaries and tags", detail: "One-line summary, category and sentiment per conversation.", status: "available" },
        { feature: "Chain state", detail: "The ledger version an answer was true as of, so it can be replayed.", status: "available" },
        { feature: "Prices at read time", detail: "The prices a figure rested on, kept alongside the answer.", status: "available" },
        { feature: "Failed lookups", detail: "Reads that did not happen, so a thin answer is never mistaken for a complete one.", status: "available" },
        { feature: "Named sources per answer", detail: "Every document, contract, transaction, price and position the answer rested on, listed individually.", status: "available" },
        { feature: "Documentation version", detail: "The content hash of the page as it stood when the answer was given, so the exact text can be identified later.", status: "available" },
        { feature: "Transaction provenance", detail: "Hashes recorded, and marked according to whether the user pasted it or TxID found it.", status: "available" },
        { feature: "Service updates", detail: "Post your own message during an issue. The assistant treats it as more current than your documentation and will not answer around it.", status: "available" },
        { feature: "Scoped updates", detail: "Name the affected topics and the assistant keeps helping with everything else, so support load falls rather than rises.", status: "available" },
        { feature: "Post an update by API", detail: "POST /api/v1/status with your secret key, so your runbook can do it without anyone opening the dashboard.", status: "available" },
        { feature: "Basis of every answer", detail: "Verified from chain, answered from documentation, or from general knowledge. Determined from what happened, never self-reported.", status: "available" },
        { feature: "Request context", detail: "Country, coarse device, surface and language. No IP address is stored in the record. Infrastructure providers process IPs to route and rate limit requests, under their own retention policies.", status: "available" },
        { feature: "Append-only", detail: "Enforced in the database: content and evidence cannot be rewritten.", status: "available" },
        { feature: "Access log", detail: "Who viewed, exported or erased a record, and when.", status: "available" },
        { feature: "Change history", detail: "Who changed which settings, and when. Append-only, and never records a credential value.", status: "available" },
        { feature: "Team access", detail: "Invite colleagues to the dashboard as Admin or Member.", status: "available" },
        { feature: "Roles", detail: "Admin, Developer, Support and Auditor, enforced on the server rather than hidden in the interface.", status: "available" },
        { feature: "Auditor role", detail: "Reads and exports the full record, changes nothing. Safe to hand an external auditor.", status: "available" },
        { feature: "Retrieval evidence", detail: "What the documentation search returned for each answer, and what it cost in context.", status: "available" },
        { feature: "Recorded erasure", detail: "Deletion leaves a tombstone, so a gap is never unexplained.", status: "available" },
        { feature: "CSV export", detail: "Includes ledger version, country, model and answer hash.", status: "available" },
        { feature: "Full-text case search", detail: "Search across the whole record set.", status: "coming" },
        { feature: "Retention controls", detail: "Configurable per project, and enforced.", status: "coming" },
        { feature: "SOC 2 audit", detail: "Not held today.", status: "coming" },
      ]},

      { type: "h2", text: "Escalation and workflow" },
      { type: "features", items: [
        { feature: "Support tickets", detail: "Raised from the widget or the dashboard, with the investigation attached.", status: "available" },
        { feature: "Notifications", detail: "Slack, Discord, Telegram.", status: "available" },
        { feature: "Issue trackers", detail: "Linear, GitHub, Jira. The issue URL is written back to the ticket.", status: "available" },
        { feature: "Outbound webhooks", detail: "HMAC-signed, with a delivery log.", status: "available" },
        { feature: "Why it reached you", detail: "Each ticket says what actually caused the escalation: a documentation gap, a failed read, an answer with no source. Computed, not the assistant's own account.", status: "available" },
        { feature: "Triage by verifiability", detail: "Sort the queue so conversations nothing can be checked against come first.", status: "available" },
        { feature: "Assignment and priority", detail: "Owner, urgency, and statuses including waiting on user.", status: "available" },
        { feature: "Ticket history", detail: "Every status change, assignment, note and reply in order, with who did it. Append-only.", status: "available" },
        { feature: "Log external replies", detail: "Record a reply you sent by email or CRM, with a link to it, so the trail stays continuous.", status: "available" },
        { feature: "Inbound email capture", detail: "Replies parsed onto the ticket automatically. Today this is recorded by hand.", status: "coming" },
        { feature: "Delivery retry", detail: "A failed escalation is retried on a backoff and stays visible until it lands, rather than being lost.", status: "available" },
      ]},

      { type: "h2", text: "Analytics" },
      { type: "features", items: [
        { feature: "Volume and trends", detail: "Conversations over time, by chain.", status: "available" },
        { feature: "Categories and sentiment", detail: "What users ask about, and how those conversations end.", status: "available" },
        { feature: "Filter by source", detail: "Widget, Telegram and preview conversations tagged and filterable, since they are not the same product.", status: "available" },
        { feature: "Gaps view", detail: "What was never answered at all, marked unhelpful, escalated, or ended badly without escalating.", status: "available" },
        { feature: "Answered without a source", detail: "Surfaces answers with no live read and no documentation behind them: the only category nobody can check.", status: "available" },
        { feature: "Knowledge vs data gaps", detail: "Separates missing documentation from failed chain reads, because the fixes have different owners.", status: "available" },
        { feature: "Documentation coverage", detail: "What your docs did not cover, what they covered weakly, and the context cost per answer.", status: "available" },
        { feature: "What they keep asking", detail: "Ranked phrases from users' own words across conversations that went badly. The write-this-next list.", status: "available" },
      ]},

      { type: "h2", text: "Branding and configuration" },
      { type: "features", items: [
        { feature: "White-label", detail: "Your colours, font, logo, agent name and avatar.", status: "available" },
        { feature: "Placement", detail: "Bottom-right, bottom-left, or inline in a container.", status: "available" },
        { feature: "Live preview", detail: "Updates as you type, before anything goes live.", status: "available" },
        { feature: "Go-live control", detail: "Show or hide the widget without touching your code.", status: "available" },
      ]},

      { type: "h2", text: "Trust and safety" },
      { type: "features", items: [
        { feature: "Read-only", detail: "No keys, no signing, no custody. Nothing can move funds.", status: "available" },
        { feature: "No financial advice", detail: "Refuses buy/sell/hold, price predictions, tax and legal questions on every plan, then gives the facts instead. Not switchable.", status: "available" },
        { feature: "Advice requests labelled", detail: "Conversations where a user asked for advice are categorised, so you can show how often it came up.", status: "available" },
        { feature: "Widget disclaimer", detail: "Shown under the chat box and attached to every escalation. On by default.", status: "available" },
        { feature: "Sanctions screening", detail: "On request, against the on-chain oracle, with the source cited. EVM only.", status: "available" },
        { feature: "Audit references", detail: "Your audits surfaced when users ask about security.", status: "available" },
        { feature: "Abuse protection", detail: "Invisible Turnstile and per-IP rate limits on public surfaces.", status: "available" },
        { feature: "Actions", detail: "User-authorised transactions, signed in the user's own wallet. Off by default, paid plans only.", status: "optional" },
      ]},

      { type: "h2", text: "Chains" },
      { type: "features", items: [
        { feature: "Aptos", detail: "Move-native: modules, resources, aborts and protocol accounts.", status: "available" },
        { feature: "Ethereum, Base, Arbitrum, Optimism", detail: "Full EVM diagnosis.", status: "available" },
        { feature: "BNB Chain, Polygon, Avalanche", detail: "Full EVM diagnosis.", status: "available" },
        { feature: "Etherlink", detail: "Tezos EVM Layer 2, via Blockscout.", status: "available" },
        { feature: "Solana", detail: "Plumbing in place, hidden in the interface for now.", status: "paused" },
      ]},

      { type: "callout", variant: "tip", title: "Something missing?", text: "Tell us what you are building at team@txid.support. Anything marked Coming is genuinely not built yet, and a chain or capability you need may move up the list." },
    ],
  },
  // ── GETTING STARTED ──────────────────────────────────────────────────────
  {
    slug: "introduction",
    title: "Introduction",
    description: "What TxID is and how it works",
    category: "getting-started",
    order: 0,
    content: [
      { type: "p", text: "TxID gives your DeFi protocol an AI-powered support agent embedded directly in your app. Users get instant, on-chain-aware answers about their transactions, token locks, staking positions, and vesting schedules, without leaving your interface, without Discord, and without waiting for a human to respond." },
      { type: "h2", text: "How it works" },
      { type: "p", text: "The widget sits in the corner of your app as a floating chat button. When a user opens it and asks a question, the AI:" },
      { type: "ul", items: [
        "Reads the user's wallet transaction history across whichever chains you've enabled",
        "Queries your smart contracts on-chain to answer specific questions about balances, locks, and schedules",
        "Searches your indexed documentation for protocol-specific information",
        "Displays custom content you've configured: FAQs, announcements, videos, and links",
        "Escalates to a ticket if it can't resolve the issue, with full conversation context attached",
      ]},
      { type: "h2", text: "Key concepts" },
      { type: "grid", items: [
        { title: "Project", description: "Your TxID workspace. One project per protocol or app." },
        { title: "Widget", description: "The chat interface embedded in your app via a script tag. Fully styled to match your branding." },
        { title: "Knowledge Base", description: "URLs from your documentation that the AI indexes and searches when answering questions." },
        { title: "Content Blocks", description: "Custom cards shown in the widget's Info tab: FAQs, videos, announcements, and more." },
        { title: "Chains", description: "The blockchains the AI scans when looking up a user's wallet history and contract state." },
        { title: "Tickets", description: "Escalations created when a user marks an AI response as unhelpful. Routed to your team with full context." },
      ]},
      { type: "h2", text: "Who is it for?" },
      { type: "p", text: "TxID is built for DeFi protocols whose users regularly have questions about on-chain state: lock expiry, failed transactions, staking rewards, vesting cliffs. It's especially valuable for protocols using Team Finance, Unicrypt, or similar locking mechanisms, where users frequently ask 'when does my lock expire?'" },
      { type: "callout", variant: "tip", title: "It reads the chain, it does not guess", text: "TxID is a support agent, not a document search box. It reads live on-chain state on the user's behalf, cites what it read, and says so when it cannot verify something." },
    ],
  },

  {
    slug: "quick-start",
    title: "Quick Start",
    description: "Get your widget live in under 30 minutes",
    category: "getting-started",
    order: 1,
    content: [
      { type: "p", text: "From sign-up to a live widget takes about 20-30 minutes. Most of that is indexing your docs and adding your contracts. The embed itself takes under 2 minutes." },
      { type: "steps", items: [
        { title: "Sign up and create your project", description: "Go to app.txid.support, sign up, and complete the onboarding. You'll set your project name (shown in the widget header) and choose your mode." },
        { title: "Configure branding", description: "Set your widget colours, choose a font, upload your logo, and pick a widget position (bottom-right, bottom-left, or inline). The live preview updates as you make changes." },
        { title: "Add your smart contracts", description: "Paste each relevant contract address, select its chain, and upload or paste the ABI. The AI uses this to answer on-chain questions: lock expiry, staking balances, vesting schedules." },
        { title: "Index your documentation", description: "Paste URLs from your docs, whitepaper, or FAQ pages. The AI crawls and chunks each page, then searches them when users ask questions. Aim for 10-20 high-quality pages to start." },
        { title: "Enable the right chains", description: "Toggle on only the chains your protocol is deployed on. The AI scans these chains when looking up wallet history and contract state." },
        { title: "Embed the widget", description: "Copy the two-line embed snippet from the Embed & Go Live page and paste it before the closing </body> tag in your app." },
        { title: "Go live", description: "Click 'Go live' in the dashboard. The widget becomes visible to your users. You can pause at any time from the dashboard." },
      ]},
      { type: "callout", variant: "info", title: "Evaluation tier", text: "Evaluation includes 150 conversations per month, enough to test the full product and validate it with real users before you move to Enterprise." },
      { type: "h2", text: "What's next" },
      { type: "p", text: "Once your widget is live, read through a few real conversations from the Conversations page each week. You'll quickly spot gaps in your knowledge base: pages worth adding, or questions the AI handled less well than you'd like." },
    ],
  },

  // ── CONFIGURATION ─────────────────────────────────────────────────────────
  {
    slug: "branding",
    title: "Branding",
    description: "Customise the widget's appearance to match your protocol",
    category: "configuration",
    order: 0,
    content: [
      { type: "p", text: "The Branding page controls everything visible in the widget: colours, font, logo, and position. Changes are reflected immediately in the live preview on the right side of the page." },
      { type: "h2", text: "Colours" },
      { type: "p", text: "The widget uses four colour values that control every visible element:" },
      { type: "grid", items: [
        { title: "Primary colour", description: "The widget header bar and send button. Use your main brand colour." },
        { title: "Secondary colour", description: "AI message bubble backgrounds. Usually a slightly lighter or darker shade of your primary colour." },
        { title: "Background colour", description: "The main chat area behind the messages. Most DeFi protocols use a very dark value (#0b0c14 or similar)." },
        { title: "Text colour", description: "All text inside the widget. Must contrast with both the background and primary colours." },
      ]},
      { type: "callout", variant: "tip", title: "Check contrast", text: "Run your text colour against both the background and primary colours in a contrast checker before going live. Readability matters more than brand precision. Users need to read chat messages comfortably." },
      { type: "h2", text: "Font" },
      { type: "p", text: "Six fonts are available, all optimised for UI legibility:" },
      { type: "ul", items: [
        "Inter: clean sans-serif, the safest choice for most protocols",
        "Sora: modern geometric sans-serif with a slightly technical feel",
        "Space Mono: monospaced, strong technical identity, popular in DeFi",
        "DM Sans: friendly humanist sans-serif",
        "IBM Plex Mono: monospaced with a professional feel",
        "Outfit: geometric sans-serif with strong character",
      ]},
      { type: "h2", text: "Logo" },
      { type: "p", text: "Upload a square PNG or SVG logo (minimum 64×64px). It appears in the widget header next to your project name. If no logo is uploaded, the first letter of your project name is shown in a coloured circle instead." },
      { type: "h2", text: "Position" },
      { type: "p", text: "Three widget positions are available:" },
      { type: "ul", items: [
        "Bottom-right: the standard floating button position (default, works for most apps)",
        "Bottom-left: mirrors bottom-right, for apps where the right corner is occupied by another element",
        "Inline: embeds the widget directly in your page layout rather than as a floating overlay",
      ]},
      { type: "callout", variant: "info", title: "Test in Preview first", text: "Use the Preview page to confirm branding looks correct on a dark background before going live. Branding changes take effect immediately for all live users the moment you save." },
    ],
  },

  {
    slug: "smart-contracts",
    title: "Smart Contracts",
    description: "Add your contracts so the AI can look up live on-chain state",
    category: "configuration",
    order: 1,
    content: [
      { type: "p", text: "Smart contracts are what make TxID different from a generic chatbot. When you add your contracts, the AI can read live on-chain data, answering questions like 'is my token locked?', 'when does my vesting cliff end?', and 'what's my pending staking reward?' with real blockchain data rather than approximations." },
      { type: "h2", text: "What the AI can do with contracts" },
      { type: "ul", items: [
        "Look up token lock amounts and expiry dates (Team Finance, Unicrypt, UNCX, custom lock contracts)",
        "Read vesting schedules and calculate what's currently claimable",
        "Check staking positions, reward rates, and pending rewards",
        "Query LP lock durations and unlock conditions",
        "Call any public read (view/pure) function defined in the contract ABI",
      ]},
      { type: "h2", text: "Adding a contract" },
      { type: "steps", items: [
        { title: "Go to Smart Contracts", description: "Click Smart Contracts in the dashboard sidebar." },
        { title: "Enter the contract address", description: "Paste the full checksum address (0x...) of the deployed contract." },
        { title: "Select the chain", description: "Choose the chain this contract is deployed on. The AI only queries it on that specific chain." },
        { title: "Paste the ABI", description: "Paste the contract ABI as JSON. The ABI tells the AI what functions are available and how to call them. You can usually find the ABI on Etherscan, BaseScan, or the contract's verified source code page." },
        { title: "Add a descriptive name", description: "Label the contract clearly (e.g. 'Team Finance Lock Contract') so the AI understands its purpose when deciding whether to query it." },
      ]},
      { type: "h2", text: "Common contract types" },
      { type: "grid", items: [
        { title: "Token lock contracts", description: "Team Finance, Unicrypt/UNCX, or custom lock contracts. The AI looks up lock amounts, expiry timestamps, and owner addresses." },
        { title: "Vesting contracts", description: "Linear or cliff vesting. The AI reads each beneficiary's schedule, cliff date, and claimable amount." },
        { title: "Staking pools", description: "Single-asset or LP staking. The AI reports staked balances, pending rewards, and any lock periods." },
        { title: "Token contracts", description: "ERC-20 contracts. The AI can look up balances, allowances, and basic token info for a connected wallet." },
      ]},
      { type: "callout", variant: "warning", title: "Read-only", text: "The AI only calls read (view/pure) functions. It never initiates write transactions or requests wallet signatures. No user funds can be moved by the widget under any circumstances." },
      { type: "callout", variant: "tip", title: "Trim the ABI", text: "You don't need to provide the full ABI if it's very large. A filtered ABI containing only the relevant read functions works equally well and keeps the AI's reasoning context cleaner." },
    ],
  },

  {
    slug: "sub-accounts",
    title: "Sub Accounts",
    description: "For protocols that hold user funds in a per-user account rather than the wallet",
    category: "configuration",
    order: 2,
    content: [
      { type: "p", text: "Some protocols do not hold a user's funds in their wallet. A perps or margin venue gives each user a sub account, an on-chain object owned by their wallet, and that is where collateral and open positions actually live. Those users have two addresses, and the two are not interchangeable." },
      { type: "p", text: "This matters more than it sounds. A trader who connects their wallet and then sees a second address they do not recognise usually assumes something has gone wrong, and support gets \"why is a different address showing as connected?\". Turning sub accounts on removes that question instead of answering it." },

      { type: "h2", text: "What changes when it is on" },
      { type: "ul", items: [
        "The moment a user connects, TxID resolves their sub account and shows both addresses in the widget, each labelled, so neither is a surprise.",
        "Both addresses are available in full, with a copy button, not only in shortened form.",
        "The assistant is told about both before the user's first question, so it never has to discover the second address halfway through an answer.",
        "Answers name which address they mean every time, rather than printing a bare 0x and leaving the user to work it out.",
      ]},

      { type: "callout", variant: "warning", title: "Why the full address is always shown", text: "A shortened address is not something a user can verify. Address-poisoning scams generate lookalike addresses whose first and last characters match a real one exactly, so an abbreviation confirms nothing. TxID always makes the complete address available, and tells users why." },

      { type: "h2", text: "Turning it on" },
      { type: "steps", items: [
        { title: "Open Smart Contracts", description: "Sub accounts has its own section on the Smart Contracts page in the dashboard." },
        { title: "Check the status line", description: "It tells you whether your watched contracts actually use sub accounts. If they do, it also shows what your protocol calls them, and that is the word the widget and the assistant will use." },
        { title: "Switch it on", description: "Users see their sub account from their next connection. Nothing else needs changing." },
      ]},

      { type: "callout", variant: "info", title: "Off by default, on purpose", text: "Most protocols keep user funds in the wallet. Showing a second address there would invent a concept your users do not have, so this stays off unless you turn it on, and it does nothing on a protocol without sub accounts." },

      { type: "h2", text: "Limits worth knowing" },
      { type: "ul", items: [
        "Support is added per protocol, since resolving a wallet to its sub account depends on how that protocol is built. Get in touch if yours is not recognised yet.",
        "One sub account per wallet. If a protocol lets a single wallet hold several, tell us before enabling this, because the wording assumes one.",
        "If the lookup itself fails, TxID shows nothing rather than claiming the user has no account. \"No sub account\" is only ever said when that is genuinely the answer.",
      ]},
    ],
  },

  {
    slug: "knowledge-base",
    title: "Docs & Knowledge Base",
    description: "Index your documentation so the AI can search and reference it",
    category: "configuration",
    order: 3,
    content: [
      { type: "p", text: "The Knowledge Base is a list of URLs that TxID indexes and searches when answering questions. When a user asks something the AI can't answer from on-chain data alone, such as how your governance works, what your tokenomics are, or how to bridge, it searches your indexed pages to find the answer." },
      { type: "h2", text: "How indexing works" },
      { type: "p", text: "When you add a URL, TxID crawls that page, extracts the main text content, and splits it into searchable chunks. When a user asks a question, the AI retrieves the most relevant chunks and uses them to compose a response. It can also cite the source page so users can read more." },
      { type: "h2", text: "What to index" },
      { type: "p", text: "Index any public page that answers questions your users are likely to ask:" },
      { type: "ul", items: [
        "Protocol documentation: how staking works, how to bridge, how to claim rewards",
        "Tokenomics pages: supply, distribution breakdown, vesting schedule overview",
        "FAQ pages: existing common questions and their answers",
        "Governance documentation: how proposals work, how to vote, quorum requirements",
        "Security information: audit report summaries, multisig setup, emergency procedures",
        "Roadmap pages: what's live, what's coming, key upcoming dates",
      ]},
      { type: "callout", variant: "tip", title: "Quality beats quantity", text: "Ten well-written, detailed documentation pages outperform fifty thin or duplicated pages. The AI retrieves chunks semantically. If your docs repeat the same information across many pages, it may retrieve lower-quality matches." },
      { type: "h2", text: "Adding a URL" },
      { type: "steps", items: [
        { title: "Go to Docs & KB", description: "Click Docs & KB in the dashboard sidebar." },
        { title: "Paste a URL", description: "Enter the full URL of the page you want indexed (e.g. https://docs.yourprotocol.io/staking)." },
        { title: "Click Index", description: "TxID crawls the page and adds the chunks to your knowledge base. Most pages index in under 30 seconds." },
        { title: "Repeat for each page", description: "Add all the key pages from your documentation. The indexed chunk count on your dashboard overview shows the running total." },
      ]},
      { type: "h2", text: "Re-indexing" },
      { type: "p", text: "Indexed content is a snapshot taken at crawl time. If your documentation changes, re-index the affected URLs to keep the AI's knowledge current. The old chunks are replaced with the new content." },
      { type: "callout", variant: "warning", title: "Public pages only", text: "The crawler can only access publicly available pages. Content behind a login, paywall, or IP restriction cannot be indexed." },
      { type: "h2", text: "Tips for better coverage" },
      { type: "ul", items: [
        "Index specific subpages rather than just your homepage (the crawler doesn't follow links automatically)",
        "Include pages that explain your core concepts in plain language, not just technical reference",
        "A single long page is fine. It will be split into searchable chunks",
        "Avoid indexing pages that are mostly navigation, headers, or boilerplate: they add noise without useful content",
        "If your docs are updated frequently, schedule a regular re-index (monthly is usually sufficient)",
      ]},
    ],
  },

  {
    slug: "chains",
    title: "Chains",
    description: "Configure which blockchains the AI scans for wallet activity",
    category: "configuration",
    order: 4,
    content: [
      { type: "p", text: "Chains control which blockchains the AI scans when a user connects their wallet. Enable only the chains your protocol is deployed on. The AI will scan those networks when looking up wallet history and querying contract state." },
      { type: "h2", text: "Supported chains" },
      { type: "grid", items: [
        { title: "Ethereum Mainnet", description: "The original EVM chain. Enable if your token or contracts are on ETH mainnet." },
        { title: "Base", description: "Coinbase's L2. Enable for Base-native protocols and tokens." },
        { title: "BNB Chain", description: "Binance's EVM chain. Enable for BSC-deployed contracts." },
        { title: "Polygon", description: "High-throughput EVM sidechain. Enable if your contracts are on Polygon PoS." },
        { title: "Arbitrum One", description: "Ethereum L2 rollup. Enable for Arbitrum-deployed protocols." },
        { title: "Optimism", description: "Ethereum L2 rollup. Enable for OP-based protocols." },
        { title: "Avalanche C-Chain", description: "Avalanche's EVM chain. Enable for Avalanche-deployed protocols." },
        { title: "Aptos", description: "Move-based L1. Reads on-chain modules and decodes Move aborts to diagnose failed transactions in plain English." },
        { title: "Etherlink", description: "The Tezos EVM Layer 2. Wallet and transaction lookups run through Blockscout rather than Moralis, which does not index it." },
        { title: "Sepolia (testnet)", description: "Ethereum testnet. Enable during development to test wallet lookup without real assets." },
      ]},
      { type: "h2", text: "Enabling and disabling chains" },
      { type: "p", text: "Toggle chains on or off from the Chains page. Changes save automatically after a short debounce. At least one mainnet chain must remain active at all times. The AI needs at least one chain to scan when responding to wallet questions." },
      { type: "callout", variant: "tip", title: "Less is faster", text: "Enable only the chains your users actually transact on. The AI scans all enabled chains on every wallet lookup; unnecessary chains add latency without adding value." },
      { type: "h2", text: "How chain detection works" },
      { type: "p", text: "When a user opens the widget and connects their wallet, the AI automatically queries their transaction history and relevant contract state across all enabled chains. The user doesn't need to specify which chain their question relates to. The AI infers context from what it finds on-chain and the content of the question." },
      { type: "callout", variant: "info", title: "Multi-chain protocols", text: "If your protocol is deployed across several chains (for example, a bridged token on Ethereum, Arbitrum, and Base), enable all the relevant chains. The AI correlates activity across networks to give complete answers." },
    ],
  },

  // ── FEATURES ──────────────────────────────────────────────────────────────
  {
    slug: "content-blocks",
    title: "Content Blocks",
    description: "Surface custom content in the Info tab of your widget",
    category: "features",
    order: 0,
    content: [
      { type: "p", text: "Content Blocks are custom cards displayed in the Info tab of the widget, the second tab alongside Chat. Use them to proactively surface important information: pinned announcements, video tutorials, quick links, FAQs, and social channels." },
      { type: "h2", text: "Block types" },
      { type: "grid", items: [
        { title: "Video", description: "A YouTube or Loom video with a thumbnail and title. The title is auto-fetched from the URL when you paste it." },
        { title: "Text / Announcement", description: "A title and free-form text body. Use for pinned announcements, maintenance notices, or protocol updates." },
        { title: "FAQ", description: "Up to 3 question-and-answer pairs rendered as an accordion. Answers expand when the user taps the question." },
        { title: "Link", description: "A titled external link: docs, a dApp, a governance page, a bridge." },
        { title: "Social", description: "Pill-style buttons linking to your social profiles: Twitter/X, Discord, Telegram, GitHub, website." },
        { title: "Tokenomics", description: "Key token numbers: total supply, distribution percentages, key unlock dates." },
        { title: "Image", description: "An uploaded image with an optional caption." },
        { title: "HTML", description: "Raw HTML for custom embeds or advanced layouts. Rendered in a sandboxed iframe." },
      ]},
      { type: "h2", text: "Adding a block" },
      { type: "steps", items: [
        { title: "Open Content", description: "Click Content in the dashboard sidebar." },
        { title: "Choose a block type", description: "Select the type from the Add Block dropdown at the bottom of the block list." },
        { title: "Fill in the fields", description: "Each block type has specific fields. For Video, paste a YouTube or Loom URL; the title fetches automatically when you move to the next field." },
        { title: "Click Add Block", description: "The block is added to the bottom of the list." },
        { title: "Reorder", description: "Drag blocks up and down using the handle on the left side to control the order they appear in the widget." },
        { title: "Save", description: "Click Save blocks. Changes are live immediately for all users." },
      ]},
      { type: "h2", text: "Video blocks" },
      { type: "p", text: "Paste a YouTube or Loom URL into the URL field and tab out. The title is fetched automatically via the platform's oEmbed API. You can override the auto-fetched title at any time. YouTube videos show a thumbnail; Loom videos show a preview image." },
      { type: "h2", text: "FAQ blocks" },
      { type: "p", text: "Each FAQ block supports up to 3 question-answer pairs. Questions expand inline when tapped. If you need more than 3 FAQ entries, add multiple FAQ blocks; they'll appear consecutively in the Info tab." },
      { type: "callout", variant: "tip", title: "FAQ blocks vs Knowledge Base", text: "FAQ blocks are proactive: they show in the Info tab before the user asks anything. The Knowledge Base is reactive: searched when the AI needs information to answer a question. Use both: FAQ blocks for your top 6 questions, Knowledge Base for comprehensive coverage." },
      { type: "h2", text: "Character limits" },
      { type: "p", text: "Block titles are limited to 50 characters. A counter appears next to the title field and turns amber as you approach the limit." },
    ],
  },

  {
    slug: "preview",
    title: "Preview",
    description: "Test your widget before publishing to users",
    category: "features",
    order: 1,
    content: [
      { type: "p", text: "The Preview page shows a live, interactive version of your widget with your current branding, content blocks, and configuration applied. Use it to test appearance and behaviour before publishing changes to real users." },
      { type: "h2", text: "What Preview shows" },
      { type: "ul", items: [
        "Your widget colours, font, and logo exactly as users will see them",
        "All configured Content Blocks in the Info tab",
        "The full chat interface (type messages and receive real AI responses)",
        "Widget position relative to the simulated page background",
      ]},
      { type: "h2", text: "Chatting in Preview" },
      { type: "p", text: "You can have a full conversation with your AI in Preview. It uses your actual knowledge base, contracts, and chain configuration, the same AI your users will interact with. This makes Preview a useful way to stress-test answers before changes go live." },
      { type: "callout", variant: "info", title: "Preview uses real quota", text: "Conversations in Preview use real AI and count toward your monthly conversation quota. Keep test sessions concise." },
      { type: "h2", text: "Testing branding changes" },
      { type: "p", text: "After updating colours, fonts, or logo on the Branding page, navigate to Preview to confirm everything looks correct. The preview reflects saved branding. Make sure you've saved your changes before checking." },
      { type: "callout", variant: "tip", text: "The Preview page uses a dark simulated background. Most DeFi apps are dark-themed, so this is a realistic test environment. If something looks off here, it'll look off in your app." },
    ],
  },

  {
    slug: "embed",
    title: "Embed & Go Live",
    description: "Add the widget to your app and publish it to users",
    category: "features",
    order: 2,
    content: [
      { type: "p", text: "Once you've configured branding, contracts, and docs, embedding the widget takes about 2 minutes. The Embed & Go Live page provides the code snippet and a one-click toggle to publish." },
      { type: "h2", text: "The embed snippet" },
      { type: "p", text: "Add a single script tag with your publishable key in the data-key attribute - the loader injects the floating widget for you:" },
      { type: "code", lang: "html", text: `<script\n  id="txid-widget-script"\n  src="https://app.txid.support/widget.js"\n  data-key="YOUR_PUBLISHABLE_KEY"\n  async>\n</script>` },
      { type: "p", text: "Paste it before the closing </body> tag in your HTML. Your publishable key is shown on the Embed & Go Live page. It's safe to include in client-side code." },
      { type: "h2", text: "Next.js / React" },
      { type: "p", text: "For Next.js App Router, add the script to your root layout:" },
      { type: "code", lang: "tsx", text: `// app/layout.tsx\nimport Script from "next/script"\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <body>\n        {children}\n        <Script\n          id="txid-widget-script"\n          src="https://app.txid.support/widget.js"\n          data-key="YOUR_PUBLISHABLE_KEY"\n          strategy="afterInteractive"\n        />\n      </body>\n    </html>\n  )\n}` },
      { type: "h2", text: "Going live" },
      { type: "p", text: "After adding the snippet, return to the Embed & Go Live page and click the Live toggle. The widget becomes visible to all users of your app immediately. There's no code change or redeploy needed to go live or to pause." },
      { type: "callout", variant: "info", title: "Embed first, go live when ready", text: "Embedding the snippet doesn't make the widget visible to users. It just loads the code in the background. The widget is hidden until you click the Live toggle in the dashboard. This lets you embed and test internally without anything showing to users." },
      { type: "h2", text: "Pausing" },
      { type: "p", text: "Click the Live toggle again to pause the widget. It disappears from your app instantly. Use this during incidents, planned maintenance, or when you want to make significant configuration changes before re-publishing." },
    ],
  },

  // ── DATA & INSIGHTS ───────────────────────────────────────────────────────
  {
    slug: "conversations",
    title: "Conversations",
    description: "View and understand your users' support conversations",
    category: "data",
    order: 0,
    content: [
      { type: "p", text: "The Conversations page shows the complete history of every conversation users have had with your AI: full transcripts, connected wallet addresses, chains, timestamps, and feedback." },
      { type: "h2", text: "What's recorded" },
      { type: "grid", items: [
        { title: "Full transcript", description: "Every message the user sent and every AI response, in order." },
        { title: "Wallet address", description: "The connected wallet address, if the user connected one during the session." },
        { title: "Chain", description: "Which chain was active when the user connected their wallet." },
        { title: "Timestamp", description: "When the conversation started." },
        { title: "Feedback", description: "Whether the user gave a thumbs up or thumbs down on the last AI response." },
        { title: "Session ID", description: "A unique identifier for the conversation, used to correlate with tickets." },
      ]},
      { type: "h2", text: "The record behind each answer" },
      { type: "p", text: "Every AI answer carries the conditions it was produced under, opened from the shield beside it. This is the part a compliance reviewer reads: the transcript says what was said, the record says whether it can be reproduced." },
      { type: "grid", items: [
        { title: "Chain state", description: "The ledger version the answer was true as of, so the exact chain state can be replayed later." },
        { title: "Prices at read time", description: "The prices any figure rested on. \"You were down $312\" cannot be checked later without them." },
        { title: "What was checked", description: "The lookups the investigation ran, and any that failed, so a thin answer is never mistaken for a complete one." },
        { title: "Request context", description: "Country, coarse device, surface and language. No IP address is stored in the record. Infrastructure providers process IPs to route and rate limit requests, under their own retention policies." },
        { title: "Model and latency", description: "Which model answered and how long it took." },
        { title: "Answer hash", description: "A SHA-256 of the answer, so any later change to the stored text is detectable." },
      ]},
      { type: "callout", variant: "info", title: "Records cannot be rewritten", text: "Message content and evidence are append-only, enforced in the database rather than the application. Deletion is refused unless erasure is explicitly requested, and an erasure leaves a tombstone recording who did it and when, so a gap in the record is never unexplained. Views, exports and erasures are logged." },
      { type: "h2", text: "Using conversation history" },
      { type: "p", text: "Conversation history is one of the highest-signal inputs for improving your AI's performance:" },
      { type: "ul", items: [
        "Find questions the AI struggled with: add better documentation to your Knowledge Base",
        "Spot confident-but-incorrect answers: update your docs or add missing contract context",
        "Identify recurring problems that might be product issues rather than support issues",
        "See which chains your users are most active on to prioritise chain configuration",
        "Understand the language your users use to describe their problems (useful for FAQ block wording)",
      ]},
      { type: "callout", variant: "tip", title: "Review weekly", text: "Spending 10 minutes reading recent conversations each week surfaces knowledge gaps faster than any dashboard metric. Look for responses with many caveats, or questions the user had to rephrase several times." },
    ],
  },

  {
    slug: "tickets",
    title: "Tickets",
    description: "Manage escalations when the AI can't resolve an issue",
    category: "data",
    order: 1,
    content: [
      { type: "p", text: "Tickets are created when a user marks the AI's last response as unhelpful (thumbs down). They route to your team with the full conversation context already attached. Whoever picks up the ticket doesn't need to ask the user to repeat themselves." },
      { type: "h2", text: "How a ticket is created" },
      { type: "steps", items: [
        { title: "User has a conversation", description: "The user asks their question and receives a response from the AI." },
        { title: "User clicks thumbs down", description: "If the last AI response wasn't helpful, the user can click the thumbs down icon shown below it." },
        { title: "Ticket is created automatically", description: "A ticket is generated with the full conversation transcript, wallet address, chain, and timestamp." },
        { title: "User is informed", description: "The widget shows 'Raising a ticket…' so the user knows a human will follow up." },
      ]},
      { type: "h2", text: "Managing tickets" },
      { type: "p", text: "Open Tickets from the dashboard sidebar to see all open and closed tickets. Each ticket shows:" },
      { type: "ul", items: [
        "The question or message that triggered the thumbs-down",
        "The full conversation thread for context",
        "The connected wallet address (if provided)",
        "The timestamp",
        "Current status: open or resolved",
      ]},
      { type: "h2", text: "Resolving tickets" },
      { type: "p", text: "Once you've addressed the user's issue (via email, Discord DM, or direct on-chain action), mark the ticket as resolved. Resolved tickets are archived but remain searchable." },
      { type: "callout", variant: "tip", title: "Tickets as training signals", text: "A spike in tickets usually indicates a gap in your Knowledge Base or a missing contract. Review the questions that generated tickets and add documentation or contract context to prevent the same question failing again." },
      { type: "callout", variant: "info", title: "One ticket per session", text: "Each conversation session generates at most one ticket. If a user clicks thumbs down multiple times in the same session, the existing ticket is updated rather than duplicates being created." },
    ],
  },

  {
    slug: "actions",
    title: "Actions",
    description: "Let users execute swaps, staking and claims from the chat, signed in their own wallet",
    category: "features",
    order: 9,
    content: [
      { type: "p", text: "Actions is an optional, paid-plan feature that lets your support agent go from explaining to doing: a user asks for something (\"swap 10 USDC for your token\", \"lock 100 tokens for 3 months\", \"claim my rewards\"), the agent prepares the transaction, and the user reviews and signs it in their own wallet. TxID never holds funds, never sends transactions, and takes no fee." },
      { type: "h2", text: "How it works" },
      { type: "ul", items: [
        "The agent only acts on explicit user requests. It never suggests or recommends trades.",
        "Swaps route through the KyberSwap aggregator between your token and major tokens (native, wrapped native, USDC, USDT, DAI).",
        "Contract actions (lock, stake, claim, and so on) call write functions on your watched contracts, but only the functions you enable.",
        "Every transaction is simulated before the user sees it. If it would revert, the agent explains why instead.",
        "Token approvals are exact-amount, never unlimited. If an action fails on-chain, the agent diagnoses it automatically.",
      ]},
      { type: "h2", text: "Enabling Actions" },
      { type: "p", text: "Go to Dashboard, then Actions. Flip the master switch, set your per-swap USD limit (0 disables swaps), and enable the specific contract functions users may execute. If a function pulls tokens from the user, annotate which token and which argument carries the amount so the agent can handle the approval step." },
      { type: "callout", variant: "info", title: "Safety rails", text: "Off by default. Wallets are screened against the OFAC sanctions list before any action, the feature is geo-restricted in sanctioned regions, and end users see a one-time acknowledgement before their first action." },
      { type: "h2", text: "What users see" },
      { type: "p", text: "A card under the agent's reply summarising the transaction, with a Review in wallet button. Their wallet (MetaMask or compatible) shows the standard confirmation. After it confirms or fails, the agent reports back in the chat." },
    ],
  },
  {
    slug: "integrations",
    title: "Integrations",
    description: "Send escalated tickets to Slack, Discord, Telegram, Linear, GitHub or Jira",
    category: "data",
    order: 4,
    content: [
      { type: "p", text: "When the agent escalates a conversation to a ticket, TxID can push it straight to where your team works. Configure integrations under Dashboard, then Integrations. Each is off until you enable it, and a Send test button confirms setup." },
      { type: "h2", text: "Notifications" },
      { type: "ul", items: [
        "Slack: paste an Incoming Webhook URL; each ticket posts to that channel.",
        "Discord: paste a channel Webhook URL.",
        "Telegram: connect a bot on the Telegram page, add it to your team channel, and paste the channel chat ID.",
      ]},
      { type: "h2", text: "Tracked issues" },
      { type: "ul", items: [
        "Linear: personal API key + team ID; a Linear issue is created and linked on the ticket.",
        "GitHub: a token with issues scope + owner/repo; opens a GitHub issue.",
        "Jira: site domain, account email, API token and project key; creates a Jira task.",
      ]},
      { type: "callout", variant: "info", title: "Your keys stay private", text: "Integration credentials are stored server-side and never sent back to your browser or exposed to the widget. Once saved, secret fields show as configured; leave them blank to keep the stored value." },
      { type: "p", text: "Both widget-raised and dashboard-raised tickets fan out to every enabled integration. Created issue links appear on each ticket in the Tickets page." },
    ],
  },
  {
    slug: "analytics",
    title: "Analytics",
    description: "Track conversation volume and engagement across your widget",
    category: "data",
    order: 2,
    content: [
      { type: "p", text: "The Analytics page gives you a high-level view of how your widget is being used: conversation volume over the last 30 days, unique wallet connections, and knowledge base size." },
      { type: "h2", text: "Key metrics" },
      { type: "grid", items: [
        { title: "Conversations", description: "Total support sessions, all time. Counted from when the user sends their first message." },
        { title: "Connected wallets", description: "Unique wallet addresses that have connected during widget sessions. A measure of distinct engaged users." },
        { title: "Knowledge base chunks", description: "The total number of indexed content chunks across all your documentation URLs. More chunks means broader coverage." },
        { title: "Active chains", description: "How many of the supported chains you currently have enabled." },
      ]},
      { type: "h2", text: "The conversation chart" },
      { type: "p", text: "The main chart shows daily conversation volume over the past 30 days. Look for:" },
      { type: "ul", items: [
        "Spikes following announcements or protocol events: users seeking clarity on changes",
        "Drops that might indicate the widget isn't loading or has been inadvertently paused",
        "Growth trends as your protocol scales and more users find the assistant",
        "Day-of-week patterns in when your community is most active",
      ]},
      { type: "callout", variant: "info", text: "Analytics data is updated in real-time. The conversation count on the Overview page always reflects the current all-time total." },
      { type: "h2", text: "Where it fell short" },
      { type: "p", text: "Below the charts, Analytics shows the conversations that did not go well: the ones a user marked unhelpful, the ones that needed a human, and the ones that ended in negative sentiment without ever escalating. That last group is the one you would otherwise never see, because those users do not complain, they just leave." },
      { type: "callout", variant: "tip", title: "Knowledge gaps versus data gaps", text: "A weak answer caused by missing documentation and one caused by a failed chain read look identical in a transcript, but the fixes have different owners. Failed reads are recorded against each answer, so the two are listed separately. Adding documentation will not fix an indexer outage." },
      { type: "h2", text: "What is not tracked yet" },
      { type: "p", text: "Resolution rate and average conversation length are not measured. Deflection rate, the share of conversations that never needed a human, is on the roadmap." },
    ],
  },
]

export function getDoc(slug: string): Doc | undefined {
  return DOCS.find(d => d.slug === slug)
}

export function getDocsByCategory(): Array<{
  key: DocCategory
  label: string
  order: number
  docs: Doc[]
}> {
  return Object.entries(DOC_CATEGORIES)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, cat]) => ({
      key: key as DocCategory,
      ...cat,
      docs: DOCS.filter(d => d.category === key).sort((a, b) => a.order - b.order),
    }))
}
