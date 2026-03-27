import type { Metadata } from "next"

export const metadata: Metadata = { title: "Dashboard Setup" }

export default function DashboardPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 not-prose">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Getting Started</p>
        <h1 className="text-3xl font-bold text-white">Dashboard Setup</h1>
        <p className="mt-2 text-[#a1a1aa]">A guide to every setting in the TxID Support dashboard.</p>
      </div>

      <h2>Branding</h2>
      <p>
        The Branding page controls how the widget looks on your users&apos; screens. Every change is reflected
        in the live preview panel on the right — no need to save and refresh.
      </p>
      <ul>
        <li><strong>Primary colour</strong> — used for the header, FAB button, and sent message bubbles.</li>
        <li><strong>Secondary colour</strong> — used for received message bubbles and avatar backgrounds.</li>
        <li><strong>Background colour</strong> — the main widget background.</li>
        <li><strong>Text colour</strong> — applied to all text inside the widget.</li>
        <li><strong>Font</strong> — choose from Inter, Sora, DM Sans, Space Mono, IBM Plex Mono, or Outfit.</li>
        <li><strong>Position</strong> — bottom-right, bottom-left, or inline (embedded in a container).</li>
        <li><strong>Theme</strong> — dark or light (affects default colour presets).</li>
      </ul>

      <h2>Token</h2>
      <p>
        Add your protocol&apos;s token address so the AI can answer questions about it with accurate on-chain context.
      </p>
      <ul>
        <li><strong>Token address</strong> — the ERC-20 contract address.</li>
        <li><strong>Chain</strong> — which network the token lives on.</li>
        <li><strong>DEX URL</strong> — a link to the token on Uniswap, PancakeSwap, etc. The AI will direct users here for price info.</li>
      </ul>

      <h2>Smart Contracts</h2>
      <p>
        Add contract addresses the AI can reference when answering user questions. See the{" "}
        <a href="/docs/contracts">Smart Contracts guide</a> for full details.
      </p>

      <h2>Chains</h2>
      <p>
        Toggle which chains your protocol operates on. The AI will only attempt on-chain lookups
        on enabled chains. Supported chains: Ethereum, Base, BNB Chain, Polygon, Arbitrum, Optimism.
      </p>

      <h2>Content Blocks</h2>
      <p>
        Add rich content blocks that appear in the widget&apos;s Info tab. Drag to reorder. Block types:
      </p>
      <ul>
        <li><strong>Text</strong> — protocol overview or announcement</li>
        <li><strong>Link</strong> — link to docs, socials, or governance</li>
        <li><strong>Video</strong> — YouTube or Loom embed</li>
        <li><strong>Tokenomics</strong> — structured tokenomics breakdown</li>
        <li><strong>Image</strong> — banner or diagram</li>
        <li><strong>HTML</strong> — custom HTML content</li>
      </ul>

      <h2>Embed</h2>
      <p>
        Copy your embed code and paste it into your protocol&apos;s website. Three options available:
        Script tag, inline iframe, and React component. See the <a href="/docs/embed">Embed guide</a>.
      </p>

      <h2>Team</h2>
      <p>
        Invite teammates via Clerk organisation management. Everyone in your organisation shares
        access to the same project and config.
      </p>
    </article>
  )
}
