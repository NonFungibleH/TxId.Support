export interface Post {
  slug: string
  title: string
  description: string
  publishedAt: string
  readingMinutes: number
  tags: string[]
  author: string
  heroVariant: string
  content: PostSection[]
}

export type PostSection =
  | { type: "p"; text?: string }
  | { type: "h2"; text?: string }
  | { type: "h3"; text?: string }
  | { type: "ul"; items?: string[] }
  | { type: "callout"; label?: string; text?: string }
  | { type: "quote"; text?: string }
  | { type: "stat-grid"; stats: Array<{ value: string; label: string }> }
  | { type: "comparison"; left: { title: string; items: string[] }; right: { title: string; items: string[] } }

export const POSTS: Post[] = [
  {
    slug: "defi-discord-support-scam-vector",
    title: "Why your DeFi protocol's Discord support is a scam vector",
    description:
      "Discord became the de-facto support channel for DeFi protocols — and scammers know it. Here's why the model is broken and what protocols are doing instead.",
    publishedAt: "2026-06-27",
    readingMinutes: 6,
    tags: ["Web3 support", "DeFi security", "Customer support"],
    author: "Non_Fungible_Howard",
    heroVariant: "discord-scam",
    content: [
      {
        type: "p",
        text: "In 2025 alone, crypto users lost an estimated $17 billion to scams. A significant share of that happened inside Discord — the platform that became the default support channel for almost every DeFi protocol launched in the last four years.",
      },
      {
        type: "p",
        text: "This isn't a coincidence. Discord's design makes it structurally impossible to run safe, trustworthy support at scale. And protocols keep using it anyway, because there hasn't been a better option.",
      },
      {
        type: "h2",
        text: "The anatomy of a Discord support scam",
      },
      {
        type: "p",
        text: "The pattern is almost always the same. A user posts in #support saying their transaction failed, or their funds are stuck, or they can't connect their wallet. Within minutes — sometimes seconds — a fake moderator slides into their DMs.",
      },
      {
        type: "p",
        text: "The fake mod looks legitimate: a profile picture, a plausible username, sometimes even a 'Verified' badge from a different server. They offer to help. They ask the user to visit a 'recovery tool', share their seed phrase, or sign a transaction that drains their wallet.",
      },
      {
        type: "ul",
        items: [
          "Discord usernames can be set to any string — impersonating 'Admin' or 'Support Team' costs nothing",
          "DMs cannot be disabled by server admins without breaking legitimate outreach",
          "Bots can scrape #support channels in real time and DM users faster than any human moderator can respond",
          "There is no verified-sender concept in Discord — every message looks equally legitimate",
        ],
      },
      {
        type: "p",
        text: "Your real support team is always racing against a bot army that has a structural head start.",
      },
      {
        type: "h2",
        text: "Why protocols haven't fixed this",
      },
      {
        type: "p",
        text: "The honest answer is that Discord filled a vacuum. Protocols needed somewhere for their community to ask questions. Discord was free, had voice channels, and their users were already there. Dedicated support tooling built for Web3 simply didn't exist.",
      },
      {
        type: "p",
        text: "The mitigations protocols try — pinning 'we will never DM you first' messages, adding bot-detection, banning scam accounts — are all reactive. They address symptoms. The root issue is that public Discord support is open-world by design: anyone can see who needs help, and anyone can respond.",
      },
      {
        type: "callout",
        label: "The core problem",
        text: "When support is public and open, it's not just your team that can see a user in distress. Every scammer watching the channel can see them too — and respond faster.",
      },
      {
        type: "h2",
        text: "What the exit from Discord looks like",
      },
      {
        type: "p",
        text: "The most effective change a protocol can make is moving support inside the application itself. Not a link to Discord, not a 'contact us' email — an actual support interface embedded in your app, at the point where the user is confused.",
      },
      {
        type: "p",
        text: "This matters for one reason above all others: authenticity. When the support agent is embedded inside app.yourprotocol.xyz, the user knows they're talking to you. There is no vector for a scammer to insert themselves between the user and the interface — the interface is your interface.",
      },
      {
        type: "ul",
        items: [
          "No DM-based phishing: support happens in your UI, not in someone's inbox",
          "Context-aware: the agent can read the user's wallet state and transaction history automatically",
          "No account required: users don't need to join a server, verify email, or wait for a moderator to notice them",
          "Async and searchable: common questions get answered once and surface in future sessions via RAG",
        ],
      },
      {
        type: "h2",
        text: "The wallet context advantage",
      },
      {
        type: "p",
        text: "Discord support is necessarily context-free. A user writes 'my transaction failed' and your moderator has to ask: which transaction? Which wallet? Which chain? What was the error?",
      },
      {
        type: "p",
        text: "An in-app support agent connected to the user's wallet already knows. It can look up the failed transaction, read the revert reason, and explain exactly what happened — before the user finishes typing their first message.",
      },
      {
        type: "quote",
        text: "The best support interaction is one where the user describes the problem and the system already knows the answer. That's only possible if the support layer has access to the same on-chain context the user is looking at.",
      },
      {
        type: "h2",
        text: "What this means for your protocol",
      },
      {
        type: "p",
        text: "Moving support in-app doesn't mean shutting down your Discord. Community building, governance discussion, announcements — Discord is fine for all of that. The change is specifically about support: questions from confused users who need accurate, timely help.",
      },
      {
        type: "p",
        text: "That interaction should happen in your app, where you control the environment, where the user's context is available, and where no scammer can interpose themselves between you and your user.",
      },
      {
        type: "p",
        text: "The protocols that get this right won't just see fewer scam reports. They'll see higher user confidence, fewer abandoned transactions, and a measurable reduction in the kind of support load that burns out community moderators.",
      },
    ],
  },
  {
    slug: "reduce-defi-support-tickets",
    title: "How to reduce DeFi support tickets by 60%",
    description:
      "Most DeFi support tickets are asking the same five questions. Here's how to identify them, eliminate them at source, and handle the rest automatically.",
    publishedAt: "2026-06-27",
    readingMinutes: 5,
    tags: ["DeFi operations", "Support automation"],
    author: "Non_Fungible_Howard",
    heroVariant: "ticket-reduction",
    content: [
      {
        type: "p",
        text: "The average DeFi protocol's support queue is predictable to a fault. Transaction failed — why? Where are my tokens? How do I bridge? Is the contract safe? These four questions make up the majority of inbound volume for almost every protocol we've spoken to.",
      },
      {
        type: "p",
        text: "That's actually good news. Predictable support is solvable support. Here's the breakdown of what works.",
      },
      {
        type: "stat-grid",
        stats: [
          { value: "60–70%", label: "of tickets cluster in fewer than 5 topics" },
          { value: "10–20%", label: "of questions need human judgment" },
          { value: "60 days", label: "typical time to measurable reduction" },
        ],
      },
      {
        type: "h2",
        text: "Step 1: Know your top five questions",
      },
      {
        type: "p",
        text: "Before you can fix anything, you need data. Pull your last 200 support tickets — Discord threads, email, Telegram, wherever they come in — and categorize them by topic. You'll almost certainly find that 60–70% cluster around fewer than five categories.",
      },
      {
        type: "p",
        text: "Common clusters for DeFi protocols:",
      },
      {
        type: "ul",
        items: [
          "Failed or pending transactions — slippage, gas, revert reasons",
          "Missing or bridged tokens — cross-chain delays, wrong network",
          "Staking and reward questions — APY calculations, lock periods",
          "Wallet connection issues — MetaMask, WalletConnect, mobile",
          "Security questions — contract verification, audit status, rug risk",
        ],
      },
      {
        type: "p",
        text: "Once you know your top five, you have a roadmap. Each one is an opportunity to eliminate a category rather than answer it ticket by ticket.",
      },
      {
        type: "h2",
        text: "Step 2: Eliminate at source, not at the queue",
      },
      {
        type: "p",
        text: "Most teams treat support as a response function. The real leverage is upstream: change the product or documentation so the question never gets asked.",
      },
      {
        type: "callout",
        label: "High-impact example",
        text: "If 30% of your tickets are about failed transactions, adding a clear slippage warning in your swap UI — before the user submits — eliminates a third of your queue without touching your support tooling.",
      },
      {
        type: "p",
        text: "For each top-five category, ask: is there a product change that makes this question unnecessary? In many cases there is. The answer is often a better error message, a clearer UI label, or a one-paragraph explainer in the right place.",
      },
      {
        type: "h2",
        text: "Step 3: Answer the remainder automatically",
      },
      {
        type: "p",
        text: "After eliminating what you can at source, the remaining tickets fall into two types: questions your documentation answers, and edge cases that need human judgment.",
      },
      {
        type: "p",
        text: "The first type — documentation questions — should be answered automatically. If your docs cover staking mechanics and users are still asking about it, the problem isn't the docs: it's that users can't find or search them at the moment they need them.",
      },
      {
        type: "p",
        text: "An AI support layer trained on your documentation handles this without any moderation overhead. It answers the question, in context, at the exact moment the user is confused — which is inside your app, not in a Discord search box.",
      },
      {
        type: "h2",
        text: "Step 4: Route edge cases to humans cleanly",
      },
      {
        type: "p",
        text: "The 10–20% of questions that genuinely need a human are the ones that matter most. A frustrated user with a unique problem, a potential bug report, a whale with an issue that needs prioritising.",
      },
      {
        type: "p",
        text: "These need to reach your team fast and with context. The worst outcome is a human hand-off that loses the conversation history — the user has to re-explain everything, trust drops, and resolution time doubles.",
      },
      {
        type: "ul",
        items: [
          "Capture a conversation summary at escalation time — not after",
          "Include wallet address and relevant transaction history with the ticket",
          "Route by category: security issues need different handling than UX confusion",
          "Set and display response time expectations — silence reads as abandonment",
        ],
      },
      {
        type: "h2",
        text: "What 60% looks like in practice",
      },
      {
        type: "p",
        text: "Protocols that run this playbook consistently report a 50–70% reduction in human-handled tickets within 60 days. The gains compound: as the AI handles more documentation questions, your team spends more time on edge cases, which surfaces real product issues faster, which reduces the volume of future tickets.",
      },
      {
        type: "quote",
        text: "The goal isn't to deflect users — it's to make sure the right answer reaches them as fast as possible, and that your team only sees the problems they're actually equipped to solve.",
      },
      {
        type: "p",
        text: "None of this requires a large team or a complex stack. It requires knowing what questions you're getting, eliminating the ones that shouldn't exist, and automating the ones that are genuinely answerable.",
      },
    ],
  },
  {
    slug: "docs-qa-defi-protocol",
    title: "How to set up docs Q&A for your DeFi protocol",
    description:
      "Paste your documentation URL and an AI support agent can answer user questions from it directly — but what you put in your docs, and how you structure them, determines whether the answers are actually good. Here's how to do it right.",
    publishedAt: "2026-06-28",
    readingMinutes: 7,
    tags: ["DeFi operations", "Web3 support", "Documentation"],
    author: "Non_Fungible_Howard",
    heroVariant: "docs-qa",
    content: [
      {
        type: "p",
        text: "The pitch is simple: give your support agent a URL, it crawls your docs, and from that point on it can answer user questions based on what you've written. No manual Q&A pairs, no taxonomy work, no training data — just your existing documentation.",
      },
      {
        type: "p",
        text: "The pitch is accurate, but it glosses over some things that matter. The quality of the answers is directly proportional to the quality of the source material. A crawler can only work with what's there.",
      },
      {
        type: "h2",
        text: "What the crawler actually does",
      },
      {
        type: "p",
        text: "When you paste a documentation URL, the crawler fetches the page, extracts the text content, chunks it into overlapping segments, and stores those chunks as vector embeddings. When a user asks a question, the support agent retrieves the most relevant chunks and uses them to construct an answer.",
      },
      {
        type: "p",
        text: "This retrieval step — not the underlying language model — is where most docs Q&A systems fail. If the relevant content isn't in the index, the model will either hallucinate an answer or admit it doesn't know. The model can only work with what retrieval surfaces.",
      },
      {
        type: "callout",
        label: "The retrieval problem in plain terms",
        text: "A docs Q&A system is only as good as its ability to find the right passage at query time. A brilliant language model paired with poor documentation retrieval produces confidently wrong answers. A mediocre model with well-structured docs retrieves the right passage and quotes it accurately.",
      },
      {
        type: "h2",
        text: "What kinds of docs work best",
      },
      {
        type: "p",
        text: "Not all documentation formats are equally indexable. HTML pages with clean semantic markup are ideal. The crawler can identify headings, paragraphs, code blocks, and lists, which gives it good signal for chunking — keeping related content together and avoiding splits in the middle of explanations.",
      },
      {
        type: "p",
        text: "Static site generators like Docusaurus, GitBook, and Nextra all produce well-structured HTML. If your docs are built with one of these, you're starting from a good place.",
      },
      {
        type: "ul",
        items: [
          "Works well: HTML pages with semantic structure, Docusaurus, GitBook, Nextra, GitHub wikis, Notion (when published publicly)",
          "Works with caveats: dynamically rendered pages (React/Next with client-side routing) — the crawler must execute JavaScript to see the content",
          "Works poorly: PDFs embedded in iframes, documentation behind authentication walls, pages that require wallet connection to view",
          "Does not work: PDFs without text layers (scanned documents), video content, images with text",
        ],
      },
      {
        type: "h2",
        text: "What to include in your docs to help the AI",
      },
      {
        type: "p",
        text: "This is where protocol teams leave the most value on the table. Most DeFi documentation was written for humans who are actively trying to learn. But Q&A retrieval favors documentation written for humans who are confused and looking for a specific answer.",
      },
      {
        type: "p",
        text: "The practical difference: instead of a 2,000-word explanation of how your staking mechanism works, have a section that directly answers the questions users actually ask.",
      },
      {
        type: "ul",
        items: [
          "Write explicit question-and-answer sections — 'Why did my transaction fail?' is a better heading than 'Transaction troubleshooting'",
          "Include the exact error messages users will see, followed by what they mean — revert reasons like INSUFFICIENT_OUTPUT_AMOUNT should appear verbatim in your docs",
          "Document edge cases separately — what happens at the lock expiry boundary, what happens if gas spikes mid-transaction, what happens when liquidity is low",
          "Describe numbers explicitly — if your staking lock is 14 days, write '14 days' not 'two weeks'; units and precision matter for retrieval matching",
          "Add a dedicated FAQ page that consolidates the most common support questions — even if they're answered elsewhere, a single high-density page retrieves well",
        ],
      },
      {
        type: "h2",
        text: "Common pitfalls",
      },
      {
        type: "h3",
        text: "PDFs and protected content",
      },
      {
        type: "p",
        text: "PDFs are a significant failure mode. A PDF linked from your docs page won't be indexed unless you explicitly add it as a separate source. And PDFs created by scanning physical documents, or exported from tools that embed text as images, are opaque to a text-based crawler — the content simply isn't there.",
      },
      {
        type: "p",
        text: "The same problem applies to documentation behind authentication. If users need to log in to read your audit report, the crawler can't read it either. Either publish audits publicly as HTML, or paste the content directly into an indexable page.",
      },
      {
        type: "h3",
        text: "Dynamically rendered content",
      },
      {
        type: "p",
        text: "Single-page applications that render documentation client-side are a common trap. The crawler fetches the page URL and gets back an almost-empty HTML shell — the actual content loads via JavaScript after the initial response. Check what the crawler actually indexed: if it shows only your nav and footer text, your docs are rendering client-side and you need a crawler that executes JavaScript.",
      },
      {
        type: "h3",
        text: "Stale content",
      },
      {
        type: "p",
        text: "The index is a snapshot. If you update your docs and don't re-index, the support agent answers from the old version. Set a re-crawl schedule — weekly is reasonable for most protocols, daily if you're actively shipping changes. Some teams trigger re-indexing as part of their docs deployment pipeline, which is the cleanest solution.",
      },
      {
        type: "h2",
        text: "Structuring your docs for retrieval, not just for reading",
      },
      {
        type: "p",
        text: "The single most impactful structural change is moving from narrative documentation to reference documentation. Narrative docs tell a story — they're great for onboarding users who read sequentially. Reference docs answer specific questions — they're what retrieval systems find.",
      },
      {
        type: "p",
        text: "You don't have to choose between the two. Keep your getting-started guides and conceptual explanations. Add a separate reference section that's structured around the questions users will ask. Think of it as a page your support agent can quote directly.",
      },
      {
        type: "quote",
        text: "Write your reference docs as if you're writing the answer to a question, not explaining a concept. 'The lock period is 14 days from deposit date, after which you can withdraw without penalty' retrieves better than a paragraph explaining why lock periods exist.",
      },
      {
        type: "h2",
        text: "Testing your docs Q&A before launch",
      },
      {
        type: "p",
        text: "Before pointing real users at a docs-powered support agent, test it against your own support history. Take your last 20 inbound questions and run them through the agent. If it answers fewer than 14 or 15 correctly, the gap is almost always in the docs — not the model.",
      },
      {
        type: "p",
        text: "For questions where the agent hallucinates or says it doesn't know, add the answer explicitly to your documentation. The feedback loop between support questions and documentation gaps is the most useful quality signal you have.",
      },
    ],
  },
  {
    slug: "wallet-aware-support-vs-generic-chatbots",
    title: "Wallet-aware support vs generic chatbots: what's the difference",
    description:
      "Generic chatbots have no idea who your user is, what chain they're on, or what their last transaction did. Wallet-aware support does — and that changes everything about the quality of help it can provide.",
    publishedAt: "2026-06-28",
    readingMinutes: 6,
    tags: ["Web3 support", "DeFi operations"],
    author: "Non_Fungible_Howard",
    heroVariant: "wallet-vs-generic",
    content: [
      {
        type: "p",
        text: "Put a generic chatbot in a DeFi app and you've improved on nothing. The user types 'my transaction failed', the bot says 'I'm sorry to hear that — could you tell me more about the transaction?', and the user immediately opens Discord to find a real answer.",
      },
      {
        type: "p",
        text: "This isn't a problem with the underlying AI. The problem is that the bot has no context. It doesn't know who the user is. It doesn't know what they were trying to do. It doesn't know what actually happened. Without that, the best it can do is ask questions — which is the last thing a frustrated user wants.",
      },
      {
        type: "h2",
        text: "What generic chatbots don't know",
      },
      {
        type: "p",
        text: "When a generic support chatbot receives a message, it has exactly one piece of information: the text the user typed. Everything else — wallet address, connected chain, token balances, transaction history, current contract state — is invisible to it.",
      },
      {
        type: "p",
        text: "In most support contexts that's fine. If you're building a support bot for a SaaS product, the user's identity is usually resolved via a session cookie, and their history lives in your database. The bot can be wired up to query it.",
      },
      {
        type: "p",
        text: "DeFi is structurally different. The user's identity is their wallet address. Their history is on-chain. Neither of those is in your database — they're on a public blockchain that your chatbot has to be explicitly connected to in order to read.",
      },
      {
        type: "callout",
        label: "The identity gap",
        text: "In Web3, the user's wallet IS their identity. A support system that doesn't read the wallet doesn't know who it's talking to — and every question it receives is effectively from an anonymous stranger.",
      },
      {
        type: "h2",
        text: "How wallet-aware support works",
      },
      {
        type: "p",
        text: "A wallet-aware support agent reads the user's connected wallet state when the support session opens — silently, without asking for anything. No login, no copy-paste, no seed phrase. The user's wallet is already connected to your app; the support layer reads the same connection.",
      },
      {
        type: "p",
        text: "What it reads depends on what's relevant to your protocol, but at minimum: the wallet address, the currently connected chain ID, and recent transaction history. From that baseline, it can answer questions that a generic bot simply cannot.",
      },
      {
        type: "h3",
        text: "The failed transaction example",
      },
      {
        type: "p",
        text: "This is the clearest illustration of the difference. User sends: 'my swap failed'.",
      },
      {
        type: "comparison",
        left: {
          title: "Generic chatbot",
          items: [
            "\"Can you tell me what you were trying to swap?\"",
            "\"What error message did you see?\"",
            "\"Which network are you on?\"",
            "User has to describe what they don't understand",
            "Resolution time: 10–20 minutes",
          ],
        },
        right: {
          title: "Wallet-aware support",
          items: [
            "Reads connected wallet on session open",
            "Looks up the failed tx automatically",
            "Decodes the revert reason",
            "Gives a specific, actionable answer",
            "Resolution time: under 30 seconds",
          ],
        },
      },
      {
        type: "p",
        text: "Generic chatbot: 'I'm sorry to hear your swap failed. Can you tell me what you were trying to swap, on which network, and what error message you saw?'",
      },
      {
        type: "p",
        text: "Wallet-aware support: 'Your swap of 500 USDC for ETH failed 4 minutes ago. The transaction reverted because the price moved outside your 0.5% slippage tolerance before the transaction was included. Try increasing slippage to 1% in settings, or wait for a period of lower volatility.'",
      },
      {
        type: "p",
        text: "The first response asks the user to describe something they don't understand. The second explains it. The information required to generate the second response — transaction hash, revert reason, token pair, slippage setting — was all available on-chain.",
      },
      {
        type: "h3",
        text: "The wrong-network example",
      },
      {
        type: "p",
        text: "User sends: 'nothing is loading, I can't see my balance'.",
      },
      {
        type: "p",
        text: "Generic chatbot: 'This can happen for a few reasons. Have you tried refreshing the page? Are you on the correct network?'",
      },
      {
        type: "p",
        text: "Wallet-aware support: 'Your wallet is connected to Arbitrum (chain ID 42161). This protocol runs on Ethereum Mainnet — please switch networks in MetaMask to continue.'",
      },
      {
        type: "p",
        text: "Again, the difference is context. The chain ID is available the moment the wallet is connected. A support system that reads it can give a specific answer instantly. One that doesn't gives generic troubleshooting steps.",
      },
      {
        type: "h2",
        text: "What wallet-aware support cannot do",
      },
      {
        type: "p",
        text: "It's worth being precise about what reading a wallet does and doesn't enable. The wallet connection used by your app exposes the address and chain. Reading transaction history requires an RPC call. Reading contract state — vesting schedules, lock expiries, reward balances — requires knowing which contracts to query.",
      },
      {
        type: "p",
        text: "There's also a meaningful privacy consideration. Users should know that the support agent can see their wallet activity. This should be disclosed in the UI — not buried in terms of service. In practice, most users are comfortable with it (the data is public on-chain regardless), but the disclosure matters for trust.",
      },
      {
        type: "ul",
        items: [
          "What it can read: wallet address, chain ID, ETH balance, token balances, transaction history, contract state",
          "What it cannot read without additional infrastructure: detailed event logs on high-throughput chains, historical prices, data from other protocols",
          "What it should never read: seed phrases, private keys — these are never accessible via a standard wallet connection and any tool claiming otherwise is a scam",
        ],
      },
      {
        type: "h2",
        text: "Why the default is still generic chatbots",
      },
      {
        type: "p",
        text: "Building wallet-aware support is harder than dropping a generic chatbot into a chat widget. It requires RPC access, wallet connection integration, on-chain data retrieval, and a support agent that knows how to use that context when formulating answers.",
      },
      {
        type: "p",
        text: "The generic chatbot option exists because it's easy to ship. You can deploy a knowledge-base chatbot in an afternoon. Connecting it to wallet state, transaction history, and contract reads takes significantly more infrastructure.",
      },
      {
        type: "p",
        text: "But the quality gap is real and users feel it. A support experience that asks them to describe their own transaction — something they don't understand and are asking for help with — is actively worse than no chatbot at all. It delays resolution and signals that the tool isn't really trying to help.",
      },
      {
        type: "quote",
        text: "The test for any support tool in DeFi is simple: can it answer 'why did my transaction fail' without asking the user a single follow-up question? If it can't, you're not deploying support — you're deploying a different way to collect information before escalating to a human.",
      },
      {
        type: "h2",
        text: "The right frame for evaluation",
      },
      {
        type: "p",
        text: "When you're evaluating support tooling for your protocol, don't ask 'does it have an AI chatbot?' Almost everything does now. Ask: what does it know about the user before they type their first message?",
      },
      {
        type: "p",
        text: "If the answer is 'nothing except what's in your documentation', you have a docs-retrieval system. That's useful for general questions but limited for the transaction-level issues that make up the majority of DeFi support volume.",
      },
      {
        type: "p",
        text: "If the answer is 'the connected wallet address, chain, recent transactions, and relevant contract state' — you have something that can actually help.",
      },
    ],
  },
  {
    slug: "on-chain-data-support-bot",
    title: "What on-chain data should your DeFi support bot actually read?",
    description:
      "Most AI support tools are knowledge-base chatbots bolted onto a DeFi UI. Here's what separates a genuinely useful support bot from one that just rephrases your docs.",
    publishedAt: "2026-06-28",
    readingMinutes: 6,
    tags: ["DeFi operations", "Web3 support"],
    author: "Non_Fungible_Howard",
    heroVariant: "on-chain-data",
    content: [
      {
        type: "p",
        text: "There are two ways to build a support bot for a DeFi protocol. The first is to take a general-purpose LLM, feed it your documentation, and put it in a chat window. The second is to wire it into the on-chain context your users are actually looking at.",
      },
      {
        type: "p",
        text: "The difference in user experience is enormous. A doc-only bot can tell a user what slippage is. A context-aware bot can tell them that their specific swap failed because their 0.5% slippage tolerance was too tight for the ETH/USDC pool at that moment — and suggest what to try instead.",
      },
      {
        type: "h2",
        text: "The four data sources that matter",
      },
      {
        type: "p",
        text: "Not all on-chain data is equally useful for support. Here's what actually moves the needle.",
      },
      {
        type: "stat-grid",
        stats: [
          { value: "4", label: "critical on-chain data sources" },
          { value: "<2s", label: "to diagnose 'wrong network' errors" },
          { value: "0", label: "follow-up questions needed" },
        ],
      },
      {
        type: "h3",
        text: "1. Transaction history and revert reasons",
      },
      {
        type: "p",
        text: "The single highest-value data source. When a user says 'my transaction failed', the support bot should already know which transaction, why it failed at the EVM level, and what that revert reason means in plain English.",
      },
      {
        type: "p",
        text: "Revert reasons like INSUFFICIENT_OUTPUT_AMOUNT, EXPIRED, or TRANSFER_FROM_FAILED are machine-readable — a bot can translate them directly. Without transaction history, the bot has to ask the user to describe something they don't understand, which is the worst possible support interaction.",
      },
      {
        type: "h3",
        text: "2. Token balances and approvals",
      },
      {
        type: "p",
        text: "A significant portion of DeFi support questions are approval-related. 'Why can't I swap?' is often answered by 'you haven't approved the contract to spend your tokens.' A bot that can check the user's current approvals can confirm this in seconds rather than walking the user through a generic troubleshooting checklist.",
      },
      {
        type: "callout",
        label: "Common approval questions",
        text: "Has the user approved the router contract? Is the approval amount sufficient for the transaction? Did the approval transaction itself succeed? All of these are answerable from on-chain data before the user finishes typing.",
      },
      {
        type: "h3",
        text: "3. Wallet's connected chain",
      },
      {
        type: "p",
        text: "Wrong-network errors are one of the most common DeFi support issues and one of the easiest to diagnose automatically. If a user is on Polygon but trying to interact with an Ethereum contract, the bot can detect this immediately from the wallet's current chain ID and tell them exactly what to do — without any user input.",
      },
      {
        type: "p",
        text: "This is obvious in hindsight, but most support bots have no idea what chain the user is on. They respond with generic 'make sure you're on the right network' instructions instead of 'you're currently on Polygon (0x89) — please switch to Ethereum Mainnet to use this protocol'.",
      },
      {
        type: "h3",
        text: "4. Protocol-specific contract state",
      },
      {
        type: "p",
        text: "For protocols with locking, vesting, or staking mechanics, users frequently ask about their position: 'When does my lock expire?', 'How much have I earned?', 'Why can't I withdraw?'. These are not documentation questions — they're questions about that specific user's on-chain state.",
      },
      {
        type: "p",
        text: "A bot connected to your watched contracts can read lock expiry dates, vesting schedules, and reward accruals directly. A doc-only bot can only explain what vesting is in general — not when this user's tokens vest.",
      },
      {
        type: "h2",
        text: "What on-chain data is NOT useful for support",
      },
      {
        type: "p",
        text: "It's worth being explicit about the signal-to-noise problem. Pulling all on-chain data into every support interaction creates context bloat that degrades answer quality.",
      },
      {
        type: "ul",
        items: [
          "Full ERC-20 token lists — irrelevant tokens distract from the protocol's own assets",
          "Historical prices — usually not what the user is asking, and can be misleading",
          "Gas price history — useful context for 'why was my gas so high?' but rarely the root question",
          "Other protocols' state — a user of your staking protocol doesn't need Uniswap LP data in their support context",
        ],
      },
      {
        type: "p",
        text: "The right model is targeted retrieval: pull the data most likely to answer the specific question, not everything that's technically available.",
      },
      {
        type: "h2",
        text: "The integration question",
      },
      {
        type: "p",
        text: "The reason most DeFi support bots don't do this is that wallet and transaction data retrieval has historically required either running your own node or paying for RPC providers, and wiring it into a chat interface requires custom integration work.",
      },
      {
        type: "quote",
        text: "The gap between a doc-retrieval chatbot and a genuinely useful Web3 support agent is almost entirely about data access — not model quality. A GPT-4 with no wallet context is worse for DeFi support than a smaller model that knows what the user's wallet just did.",
      },
      {
        type: "p",
        text: "The practical implication: when evaluating support tooling for your protocol, the question to ask is not 'which LLM does it use?' but 'what does it know about my user before they type their first message?' That answer determines whether you're deploying a genuinely useful tool or a slightly better FAQ page.",
      },
    ],
  },
  {
    slug: "telegram-community-support",
    title: "Why your DeFi community's Telegram group needs on-chain AI support",
    description:
      "Pinned FAQs and mods can't scale with a growing DeFi community. Here's how Telegram groups can deliver wallet-aware support without creating another scam vector.",
    publishedAt: "2026-07-01",
    readingMinutes: 6,
    tags: ["Web3 support", "DeFi operations", "Customer support"],
    author: "Non_Fungible_Howard",
    heroVariant: "telegram-community-support",
    content: [
      {
        type: "p",
        text: "Telegram became the second pillar of DeFi community infrastructure, right behind Discord. And for good reason: it's faster, more mobile-friendly, and communities tend to be more engaged. But the way most protocols use it for support is almost identical to Discord — which means the same structural problems follow.",
      },
      {
        type: "p",
        text: "A user posts that their transaction failed. Mods scramble to respond. Scammers DM the user first with a fake 'recovery tool'. The protocol team writes another pinned message reminding everyone that 'we will never DM you first'. The cycle repeats.",
      },
      {
        type: "h2",
        text: "The Telegram support problem isn't moderation — it's context",
      },
      {
        type: "p",
        text: "Most protocols treat Telegram support as a moderation problem. They add more mods, create more rules, pin more warnings. But the real issue is that Telegram support is context-free by design.",
      },
      {
        type: "p",
        text: "When someone posts 'my transaction failed' in a group, no one in that group — mod or scammer — knows anything about what actually happened. Which wallet. Which chain. Which contract. What the revert reason was. The user doesn't know either, which is why they're asking.",
      },
      {
        type: "callout",
        label: "The information gap",
        text: "In a Telegram support channel, everyone is equally blind. The honest mod has to ask questions the user can't answer. The scammer just skips to the DM and offers to 'help'. Context-free support always favours bad actors.",
      },
      {
        type: "h2",
        text: "What on-chain AI support in Telegram actually looks like",
      },
      {
        type: "p",
        text: "A context-aware bot added to your Telegram group changes the dynamic entirely. When a user shares their wallet address and says their transaction failed, the bot can look up what actually happened — the revert reason, the contract that rejected the call, the exact cause in plain English — without a single follow-up question.",
      },
      {
        type: "p",
        text: "This isn't a chatbot reciting your FAQ. It's a system that reads public blockchain data, interprets it in the context of your protocol's smart contracts, and gives the user a specific answer about their specific situation.",
      },
      {
        type: "ul",
        items: [
          "User shares wallet address → bot fetches their recent failed transactions automatically",
          "Revert reason decoded: INSUFFICIENT_OUTPUT_AMOUNT becomes 'your slippage tolerance was too tight — increase it to 1% and try again'",
          "Wrong network detected in seconds: 'you're on Arbitrum, this contract is on Base — switch networks in MetaMask'",
          "Missing approval identified: 'you haven't approved the router to spend your USDC — go to Approvals in your wallet and approve the contract first'",
        ],
      },
      {
        type: "h2",
        text: "Why this closes the scam vector",
      },
      {
        type: "p",
        text: "Scams in Telegram (and Discord) work because there's a window of opportunity: the user posts asking for help, and there's a delay before they get a legitimate answer. That window is where the fake mod slides in.",
      },
      {
        type: "p",
        text: "An AI bot that responds in seconds with a specific, accurate answer closes that window. The user gets a real answer before a scammer can reach them. There's nothing to intercept.",
      },
      {
        type: "p",
        text: "There's a secondary effect too. A bot that gives a specific answer — 'your transaction hash 0x1a2b… failed because the price moved outside your slippage tolerance' — is immediately recognisable as legitimate. A scammer DM that says 'I can help you recover your funds, please visit this site' is recognisably illegitimate by comparison. The contrast matters.",
      },
      {
        type: "h2",
        text: "The setup question: shared bots vs custom bots",
      },
      {
        type: "p",
        text: "There are two ways to add on-chain support to a Telegram group. You can build and host your own bot — full control, but significant infrastructure work. Or you can add a shared support bot that's already configured to understand your project's smart contracts, documentation, and error messages.",
      },
      {
        type: "comparison",
        left: {
          title: "Custom bot",
          items: [
            "Full control over behaviour",
            "Your bot username and branding",
            "Requires: hosting, API integrations, maintenance",
            "Weeks to build and test",
            "You own the infrastructure",
          ],
        },
        right: {
          title: "Shared support bot",
          items: [
            "Configured for your contracts and docs",
            "Add to group with one command",
            "Zero infrastructure required",
            "Live in minutes",
            "Automatically updated as chains evolve",
          ],
        },
      },
      {
        type: "p",
        text: "For most protocols, the shared bot approach makes more sense at the start. The time-to-value is vastly faster, and the infrastructure maintenance cost is zero. The limitation is branding — the bot isn't @YourProtocolBot, it's a shared support bot that's been configured for your project.",
      },
      {
        type: "h2",
        text: "What to configure before adding the bot",
      },
      {
        type: "p",
        text: "An on-chain support bot is only as good as what it knows about your project. Before adding it to your group, make sure you've given it what it needs.",
      },
      {
        type: "ul",
        items: [
          "Smart contract addresses on each chain you support — so the bot can filter transactions to your protocol specifically",
          "ABI or block explorer verification for each contract — enables decoding custom revert errors, not just generic ones",
          "Your documentation URL — so the bot can answer questions about how your protocol works, not just about failed transactions",
          "A custom error glossary for your most common revert reasons — SLIPPAGE_TOO_HIGH becomes a plain-English explanation tailored to your UX",
        ],
      },
      {
        type: "p",
        text: "Each of these takes a few minutes to set up. Together they're what separates a generic blockchain bot from one that actually understands your protocol.",
      },
      {
        type: "h2",
        text: "Plan gating and abuse prevention",
      },
      {
        type: "p",
        text: "One concern protocols raise is whether a shared bot could be abused — what stops a free user from inviting the bot to twenty groups? The answer is project-level connection: the bot connects to a group only when a valid project key is provided, and each project can connect to one group. A downgrade or cancellation immediately stops the bot from responding in that group.",
      },
      {
        type: "p",
        text: "This is different from how most Telegram bots work, which are invite-and-go. The requirement to connect via a project key means access is always tied to an active subscription — not just whoever knows how to invite a bot.",
      },
      {
        type: "h2",
        text: "The floor for community support in DeFi has moved",
      },
      {
        type: "p",
        text: "Two years ago, the baseline for DeFi community support was a mod team and a set of pinned messages. That baseline has moved. Users in 2026 expect quick, specific answers — not 'please share your transaction hash and we'll look into it'.",
      },
      {
        type: "quote",
        text: "The protocols winning on support aren't the ones with the most moderators. They're the ones where users get a specific answer in under 30 seconds — in the group chat, before anyone has to DM them.",
      },
      {
        type: "p",
        text: "Telegram isn't going away as a community platform. The question is whether your protocol's presence there looks like a support channel or a scam waiting to happen.",
      },
    ],
  },
]

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}
