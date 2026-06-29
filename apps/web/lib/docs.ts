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

export interface Doc {
  slug: string
  title: string
  description: string
  category: DocCategory
  order: number
  content: DocSection[]
}

export const DOCS: Doc[] = [
  // ── GETTING STARTED ──────────────────────────────────────────────────────
  {
    slug: "introduction",
    title: "Introduction",
    description: "What TxID Support is and how it works",
    category: "getting-started",
    order: 0,
    content: [
      { type: "p", text: "TxID Support gives your DeFi protocol an AI-powered support agent embedded directly in your app. Users get instant, on-chain-aware answers about their transactions, token locks, staking positions, and vesting schedules — without leaving your interface, without Discord, and without waiting for a human to respond." },
      { type: "h2", text: "How it works" },
      { type: "p", text: "The widget sits in the corner of your app as a floating chat button. When a user opens it and asks a question, the AI:" },
      { type: "ul", items: [
        "Reads the user's wallet transaction history across whichever chains you've enabled",
        "Queries your smart contracts on-chain to answer specific questions about balances, locks, and schedules",
        "Searches your indexed documentation for protocol-specific information",
        "Displays custom content you've configured — FAQs, announcements, videos, and links",
        "Escalates to a ticket if it can't resolve the issue, with full conversation context attached",
      ]},
      { type: "h2", text: "Key concepts" },
      { type: "grid", items: [
        { title: "Project", description: "Your TxID Support workspace. One project per protocol or app." },
        { title: "Widget", description: "The chat interface embedded in your app via a script tag. Fully styled to match your branding." },
        { title: "Knowledge Base", description: "URLs from your documentation that the AI indexes and searches when answering questions." },
        { title: "Content Blocks", description: "Custom cards shown in the widget's Info tab — FAQs, videos, announcements, and more." },
        { title: "Chains", description: "The blockchains the AI scans when looking up a user's wallet history and contract state." },
        { title: "Tickets", description: "Escalations created when a user marks an AI response as unhelpful. Routed to your team with full context." },
      ]},
      { type: "h2", text: "Who is it for?" },
      { type: "p", text: "TxID Support is built for DeFi protocols whose users regularly have questions about on-chain state — lock expiry, failed transactions, staking rewards, vesting cliffs. It's especially valuable for protocols using Team Finance, Unicrypt, or similar locking mechanisms, where users frequently ask 'when does my lock expire?'" },
      { type: "callout", variant: "tip", title: "Not just a chatbot", text: "Unlike a generic AI assistant, TxID Support reads live blockchain data on behalf of the user. It doesn't guess — it looks up the answer on-chain and cites the source." },
    ],
  },

  {
    slug: "quick-start",
    title: "Quick Start",
    description: "Get your widget live in under 30 minutes",
    category: "getting-started",
    order: 1,
    content: [
      { type: "p", text: "From sign-up to a live widget takes about 20–30 minutes. Most of that is indexing your docs and adding your contracts — the embed itself takes under 2 minutes." },
      { type: "steps", items: [
        { title: "Sign up and create your project", description: "Go to app.txid.support, sign up, and complete the onboarding. You'll set your project name (shown in the widget header) and choose your mode." },
        { title: "Configure branding", description: "Set your widget colours, choose a font, upload your logo, and pick a widget position (bottom-right, bottom-left, or inline). The live preview updates as you make changes." },
        { title: "Add your smart contracts", description: "Paste each relevant contract address, select its chain, and upload or paste the ABI. The AI uses this to answer on-chain questions — lock expiry, staking balances, vesting schedules." },
        { title: "Index your documentation", description: "Paste URLs from your docs, whitepaper, or FAQ pages. The AI crawls and chunks each page, then searches them when users ask questions. Aim for 10–20 high-quality pages to start." },
        { title: "Enable the right chains", description: "Toggle on only the chains your protocol is deployed on. The AI scans these chains when looking up wallet history and contract state." },
        { title: "Embed the widget", description: "Copy the two-line embed snippet from the Embed & Go Live page and paste it before the closing </body> tag in your app." },
        { title: "Go live", description: "Click 'Go live' in the dashboard. The widget becomes visible to your users. You can pause at any time from the dashboard." },
      ]},
      { type: "callout", variant: "info", title: "Free tier", text: "The free plan includes 200 conversations per month — enough to test the full product and validate it with real users before deciding to upgrade." },
      { type: "h2", text: "What's next" },
      { type: "p", text: "Once your widget is live, read through a few real conversations from the Conversations page each week. You'll quickly spot gaps in your knowledge base — pages worth adding, or questions the AI handled less well than you'd like." },
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
      { type: "p", text: "The Branding page controls everything visible in the widget — colours, font, logo, and position. Changes are reflected immediately in the live preview on the right side of the page." },
      { type: "h2", text: "Colours" },
      { type: "p", text: "The widget uses four colour values that control every visible element:" },
      { type: "grid", items: [
        { title: "Primary colour", description: "The widget header bar and send button. Use your main brand colour." },
        { title: "Secondary colour", description: "AI message bubble backgrounds. Usually a slightly lighter or darker shade of your primary colour." },
        { title: "Background colour", description: "The main chat area behind the messages. Most DeFi protocols use a very dark value (#0b0c14 or similar)." },
        { title: "Text colour", description: "All text inside the widget. Must contrast with both the background and primary colours." },
      ]},
      { type: "callout", variant: "tip", title: "Check contrast", text: "Run your text colour against both the background and primary colours in a contrast checker before going live. Readability matters more than brand precision — users need to read chat messages comfortably." },
      { type: "h2", text: "Font" },
      { type: "p", text: "Six fonts are available, all optimised for UI legibility:" },
      { type: "ul", items: [
        "Inter — clean sans-serif, the safest choice for most protocols",
        "Sora — modern geometric sans-serif with a slightly technical feel",
        "Space Mono — monospaced, strong technical identity, popular in DeFi",
        "DM Sans — friendly humanist sans-serif",
        "IBM Plex Mono — monospaced with a professional feel",
        "Outfit — geometric sans-serif with strong character",
      ]},
      { type: "h2", text: "Logo" },
      { type: "p", text: "Upload a square PNG or SVG logo (minimum 64×64px). It appears in the widget header next to your project name. If no logo is uploaded, the first letter of your project name is shown in a coloured circle instead." },
      { type: "h2", text: "Position" },
      { type: "p", text: "Three widget positions are available:" },
      { type: "ul", items: [
        "Bottom-right — the standard floating button position (default, works for most apps)",
        "Bottom-left — mirrors bottom-right, for apps where the right corner is occupied by another element",
        "Inline — embeds the widget directly in your page layout rather than as a floating overlay",
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
      { type: "p", text: "Smart contracts are what make TxID Support different from a generic chatbot. When you add your contracts, the AI can read live on-chain data — answering questions like 'is my token locked?', 'when does my vesting cliff end?', and 'what's my pending staking reward?' with real blockchain data rather than approximations." },
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
    slug: "knowledge-base",
    title: "Docs & Knowledge Base",
    description: "Index your documentation so the AI can search and reference it",
    category: "configuration",
    order: 2,
    content: [
      { type: "p", text: "The Knowledge Base is a list of URLs that TxID Support indexes and searches when answering questions. When a user asks something the AI can't answer from on-chain data alone — how your governance works, what your tokenomics are, how to bridge — it searches your indexed pages to find the answer." },
      { type: "h2", text: "How indexing works" },
      { type: "p", text: "When you add a URL, TxID Support crawls that page, extracts the main text content, and splits it into searchable chunks. When a user asks a question, the AI retrieves the most relevant chunks and uses them to compose a response. It can also cite the source page so users can read more." },
      { type: "h2", text: "What to index" },
      { type: "p", text: "Index any public page that answers questions your users are likely to ask:" },
      { type: "ul", items: [
        "Protocol documentation — how staking works, how to bridge, how to claim rewards",
        "Tokenomics pages — supply, distribution breakdown, vesting schedule overview",
        "FAQ pages — existing common questions and their answers",
        "Governance documentation — how proposals work, how to vote, quorum requirements",
        "Security information — audit report summaries, multisig setup, emergency procedures",
        "Roadmap pages — what's live, what's coming, key upcoming dates",
      ]},
      { type: "callout", variant: "tip", title: "Quality beats quantity", text: "Ten well-written, detailed documentation pages outperform fifty thin or duplicated pages. The AI retrieves chunks semantically — if your docs repeat the same information across many pages, it may retrieve lower-quality matches." },
      { type: "h2", text: "Adding a URL" },
      { type: "steps", items: [
        { title: "Go to Docs & KB", description: "Click Docs & KB in the dashboard sidebar." },
        { title: "Paste a URL", description: "Enter the full URL of the page you want indexed (e.g. https://docs.yourprotocol.io/staking)." },
        { title: "Click Index", description: "TxID Support crawls the page and adds the chunks to your knowledge base. Most pages index in under 30 seconds." },
        { title: "Repeat for each page", description: "Add all the key pages from your documentation. The indexed chunk count on your dashboard overview shows the running total." },
      ]},
      { type: "h2", text: "Re-indexing" },
      { type: "p", text: "Indexed content is a snapshot taken at crawl time. If your documentation changes, re-index the affected URLs to keep the AI's knowledge current. The old chunks are replaced with the new content." },
      { type: "callout", variant: "warning", title: "Public pages only", text: "The crawler can only access publicly available pages. Content behind a login, paywall, or IP restriction cannot be indexed." },
      { type: "h2", text: "Tips for better coverage" },
      { type: "ul", items: [
        "Index specific subpages rather than just your homepage — the crawler doesn't follow links automatically",
        "Include pages that explain your core concepts in plain language, not just technical reference",
        "A single long page is fine — it will be split into searchable chunks",
        "Avoid indexing pages that are mostly navigation, headers, or boilerplate — they add noise without useful content",
        "If your docs are updated frequently, schedule a regular re-index (monthly is usually sufficient)",
      ]},
    ],
  },

  {
    slug: "chains",
    title: "Chains",
    description: "Configure which blockchains the AI scans for wallet activity",
    category: "configuration",
    order: 3,
    content: [
      { type: "p", text: "Chains control which blockchains the AI scans when a user connects their wallet. Enable only the chains your protocol is deployed on — the AI will scan those networks when looking up wallet history and querying contract state." },
      { type: "h2", text: "Supported chains" },
      { type: "grid", items: [
        { title: "Ethereum Mainnet", description: "The original EVM chain. Enable if your token or contracts are on ETH mainnet." },
        { title: "Base", description: "Coinbase's L2. Enable for Base-native protocols and tokens." },
        { title: "BNB Chain", description: "Binance's EVM chain. Enable for BSC-deployed contracts." },
        { title: "Polygon", description: "High-throughput EVM sidechain. Enable if your contracts are on Polygon PoS." },
        { title: "Arbitrum One", description: "Ethereum L2 rollup. Enable for Arbitrum-deployed protocols." },
        { title: "Optimism", description: "Ethereum L2 rollup. Enable for OP-based protocols." },
        { title: "Sepolia (testnet)", description: "Ethereum testnet. Enable during development to test wallet lookup without real assets." },
      ]},
      { type: "h2", text: "Enabling and disabling chains" },
      { type: "p", text: "Toggle chains on or off from the Chains page. Changes save automatically after a short debounce. At least one mainnet chain must remain active at all times — the AI needs at least one chain to scan when responding to wallet questions." },
      { type: "callout", variant: "tip", title: "Less is faster", text: "Enable only the chains your users actually transact on. The AI scans all enabled chains on every wallet lookup — unnecessary chains add latency without adding value." },
      { type: "h2", text: "How chain detection works" },
      { type: "p", text: "When a user opens the widget and connects their wallet, the AI automatically queries their transaction history and relevant contract state across all enabled chains. The user doesn't need to specify which chain their question relates to — the AI infers context from what it finds on-chain and the content of the question." },
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
      { type: "p", text: "Content Blocks are custom cards displayed in the Info tab of the widget — the second tab alongside Chat. Use them to proactively surface important information: pinned announcements, video tutorials, quick links, FAQs, and social channels." },
      { type: "h2", text: "Block types" },
      { type: "grid", items: [
        { title: "Video", description: "A YouTube or Loom video with a thumbnail and title. The title is auto-fetched from the URL when you paste it." },
        { title: "Text / Announcement", description: "A title and free-form text body. Use for pinned announcements, maintenance notices, or protocol updates." },
        { title: "FAQ", description: "Up to 3 question-and-answer pairs rendered as an accordion. Answers expand when the user taps the question." },
        { title: "Link", description: "A titled external link — docs, a dApp, a governance page, a bridge." },
        { title: "Social", description: "Pill-style buttons linking to your social profiles: Twitter/X, Discord, Telegram, GitHub, website." },
        { title: "Tokenomics", description: "Key token numbers — total supply, distribution percentages, key unlock dates." },
        { title: "Image", description: "An uploaded image with an optional caption." },
        { title: "HTML", description: "Raw HTML for custom embeds or advanced layouts. Rendered in a sandboxed iframe." },
      ]},
      { type: "h2", text: "Adding a block" },
      { type: "steps", items: [
        { title: "Open Content", description: "Click Content in the dashboard sidebar." },
        { title: "Choose a block type", description: "Select the type from the Add Block dropdown at the bottom of the block list." },
        { title: "Fill in the fields", description: "Each block type has specific fields. For Video, paste a YouTube or Loom URL — the title fetches automatically when you move to the next field." },
        { title: "Click Add Block", description: "The block is added to the bottom of the list." },
        { title: "Reorder", description: "Drag blocks up and down using the handle on the left side to control the order they appear in the widget." },
        { title: "Save", description: "Click Save blocks. Changes are live immediately for all users." },
      ]},
      { type: "h2", text: "Video blocks" },
      { type: "p", text: "Paste a YouTube or Loom URL into the URL field and tab out — the title is fetched automatically via the platform's oEmbed API. You can override the auto-fetched title at any time. YouTube videos show a thumbnail; Loom videos show a preview image." },
      { type: "h2", text: "FAQ blocks" },
      { type: "p", text: "Each FAQ block supports up to 3 question-answer pairs. Questions expand inline when tapped. If you need more than 3 FAQ entries, add multiple FAQ blocks — they'll appear consecutively in the Info tab." },
      { type: "callout", variant: "tip", title: "FAQ blocks vs Knowledge Base", text: "FAQ blocks are proactive — they show in the Info tab before the user asks anything. The Knowledge Base is reactive — searched when the AI needs information to answer a question. Use both: FAQ blocks for your top 6 questions, Knowledge Base for comprehensive coverage." },
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
        "The full chat interface — you can type messages and receive real AI responses",
        "Widget position relative to the simulated page background",
      ]},
      { type: "h2", text: "Chatting in Preview" },
      { type: "p", text: "You can have a full conversation with your AI in Preview. It uses your actual knowledge base, contracts, and chain configuration — the same AI your users will interact with. This makes Preview a useful way to stress-test answers before changes go live." },
      { type: "callout", variant: "info", title: "Preview uses real quota", text: "Conversations in Preview use real AI and count toward your monthly conversation quota. Keep test sessions concise." },
      { type: "h2", text: "Testing branding changes" },
      { type: "p", text: "After updating colours, fonts, or logo on the Branding page, navigate to Preview to confirm everything looks correct. The preview reflects saved branding — make sure you've saved your changes before checking." },
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
      { type: "p", text: "The embed consists of two script tags — a configuration object that sets your publishable key, and the widget loader:" },
      { type: "code", lang: "html", text: `<script>\n  window.TxIDConfig = { key: "YOUR_PUBLISHABLE_KEY" }\n</script>\n<script src="https://cdn.txid.support/widget.js" defer></script>` },
      { type: "p", text: "Paste both tags before the closing </body> tag in your HTML. Your publishable key is shown on the Embed & Go Live page — it's safe to include in client-side code." },
      { type: "h2", text: "Next.js / React" },
      { type: "p", text: "For Next.js App Router, add the scripts to your root layout:" },
      { type: "code", lang: "tsx", text: `// app/layout.tsx\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <body>\n        {children}\n        <script\n          dangerouslySetInnerHTML={{\n            __html: \`window.TxIDConfig = { key: "pk_YOUR_KEY" }\`\n          }}\n        />\n        <script\n          src="https://cdn.txid.support/widget.js"\n          defer\n        />\n      </body>\n    </html>\n  )\n}` },
      { type: "h2", text: "Going live" },
      { type: "p", text: "After adding the snippet, return to the Embed & Go Live page and click the Live toggle. The widget becomes visible to all users of your app immediately. There's no code change or redeploy needed to go live or to pause." },
      { type: "callout", variant: "info", title: "Embed first, go live when ready", text: "Embedding the snippet doesn't make the widget visible to users — it just loads the code in the background. The widget is hidden until you click the Live toggle in the dashboard. This lets you embed and test internally without anything showing to users." },
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
      { type: "p", text: "The Conversations page shows the complete history of every conversation users have had with your AI — full transcripts, connected wallet addresses, chains, timestamps, and feedback." },
      { type: "h2", text: "What's recorded" },
      { type: "grid", items: [
        { title: "Full transcript", description: "Every message the user sent and every AI response, in order." },
        { title: "Wallet address", description: "The connected wallet address, if the user connected one during the session." },
        { title: "Chain", description: "Which chain was active when the user connected their wallet." },
        { title: "Timestamp", description: "When the conversation started." },
        { title: "Feedback", description: "Whether the user gave a thumbs up or thumbs down on the last AI response." },
        { title: "Session ID", description: "A unique identifier for the conversation, used to correlate with tickets." },
      ]},
      { type: "h2", text: "Using conversation history" },
      { type: "p", text: "Conversation history is one of the highest-signal inputs for improving your AI's performance:" },
      { type: "ul", items: [
        "Find questions the AI struggled with — add better documentation to your Knowledge Base",
        "Spot confident-but-incorrect answers — update your docs or add missing contract context",
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
      { type: "p", text: "Tickets are created when a user marks the AI's last response as unhelpful (thumbs down). They route to your team with the full conversation context already attached — so whoever picks up the ticket doesn't need to ask the user to repeat themselves." },
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
      { type: "p", text: "Once you've addressed the user's issue — via email, Discord DM, or direct on-chain action — mark the ticket as resolved. Resolved tickets are archived but remain searchable." },
      { type: "callout", variant: "tip", title: "Tickets as training signals", text: "A spike in tickets usually indicates a gap in your Knowledge Base or a missing contract. Review the questions that generated tickets and add documentation or contract context to prevent the same question failing again." },
      { type: "callout", variant: "info", title: "One ticket per session", text: "Each conversation session generates at most one ticket. If a user clicks thumbs down multiple times in the same session, the existing ticket is updated rather than duplicates being created." },
    ],
  },

  {
    slug: "analytics",
    title: "Analytics",
    description: "Track conversation volume and engagement across your widget",
    category: "data",
    order: 2,
    content: [
      { type: "p", text: "The Analytics page gives you a high-level view of how your widget is being used — conversation volume over the last 30 days, unique wallet connections, and knowledge base size." },
      { type: "h2", text: "Key metrics" },
      { type: "grid", items: [
        { title: "Conversations", description: "Total support sessions, all time. Counted from when the user sends their first message." },
        { title: "Connected wallets", description: "Unique wallet addresses that have connected during widget sessions. A measure of distinct engaged users." },
        { title: "Knowledge base chunks", description: "The total number of indexed content chunks across all your documentation URLs. More chunks means broader coverage." },
        { title: "Active chains", description: "How many of the 7 supported chains you currently have enabled." },
      ]},
      { type: "h2", text: "The conversation chart" },
      { type: "p", text: "The main chart shows daily conversation volume over the past 30 days. Look for:" },
      { type: "ul", items: [
        "Spikes following announcements or protocol events — users seeking clarity on changes",
        "Drops that might indicate the widget isn't loading or has been inadvertently paused",
        "Growth trends as your protocol scales and more users discover the support widget",
        "Day-of-week patterns in when your community is most active",
      ]},
      { type: "callout", variant: "info", text: "Analytics data is updated in real-time. The conversation count on the Overview page always reflects the current all-time total." },
      { type: "h2", text: "What's not tracked yet" },
      { type: "p", text: "The current dashboard focuses on volume. More granular metrics — resolution rate, average conversation length, most common question topics, per-chain breakdown of conversations — are on the roadmap." },
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
