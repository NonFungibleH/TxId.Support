export interface Post {
  slug: string
  title: string
  description: string
  publishedAt: string
  readingMinutes: number
  tags: string[]
  content: PostSection[]
}

export interface PostSection {
  type: "p" | "h2" | "h3" | "ul" | "callout" | "quote"
  text?: string
  items?: string[]
  label?: string
}

export const POSTS: Post[] = [
  {
    slug: "defi-discord-support-scam-vector",
    title: "Why your DeFi protocol's Discord support is a scam vector",
    description:
      "Discord became the de-facto support channel for DeFi protocols — and scammers know it. Here's why the model is broken and what protocols are doing instead.",
    publishedAt: "2026-06-27",
    readingMinutes: 6,
    tags: ["Web3 support", "DeFi security", "Customer support"],
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
    slug: "on-chain-data-support-bot",
    title: "What on-chain data should your DeFi support bot actually read?",
    description:
      "Most AI support tools are knowledge-base chatbots bolted onto a DeFi UI. Here's what separates a genuinely useful support bot from one that just rephrases your docs.",
    publishedAt: "2026-06-28",
    readingMinutes: 6,
    tags: ["DeFi operations", "Web3 support"],
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
]

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}
