import type { Metadata } from "next"

export const metadata: Metadata = { title: "Quick Start" }

export default function QuickStartPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 not-prose">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Getting Started</p>
        <h1 className="text-3xl font-bold text-white">Quick Start</h1>
        <p className="mt-2 text-[#a1a1aa]">Add AI-powered DeFi support to your protocol in under 5 minutes.</p>
      </div>

      <h2>1. Create your project</h2>
      <p>
        Sign in at <a href="https://app.txid.support">app.txid.support</a> with your team&apos;s account.
        On the dashboard overview page, enter your protocol name and click <strong>Create project</strong>.
        Your project is created instantly with a unique API key.
      </p>

      <h2>2. Configure your widget</h2>
      <p>Visit the dashboard pages to configure your widget:</p>
      <ul>
        <li><strong>Branding</strong> — set colours, font, and widget position. A live preview updates as you type.</li>
        <li><strong>Token</strong> — add your token address and chain for token-aware responses.</li>
        <li><strong>Smart Contracts</strong> — add contract addresses the AI can query on behalf of users.</li>
        <li><strong>Chains</strong> — toggle which chains your protocol supports.</li>
      </ul>

      <h2>3. Embed the widget</h2>
      <p>Go to <strong>Embed</strong> in the sidebar and copy one of the three snippets:</p>

      <h3>Script tag (simplest)</h3>
      <pre><code>{`<script>
  (function(){
    var f = document.createElement('iframe');
    f.src = "https://app.txid.support/widget?key=YOUR_KEY";
    f.allow = "clipboard-write";
    f.style.cssText = "position:fixed;bottom:20px;right:20px;width:380px;height:580px;border:none;z-index:2147483647;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4)";
    document.body.appendChild(f);
  })();
</script>`}</code></pre>

      <h3>React / npm</h3>
      <pre><code>{`npm install @txid/react

import { TxIDWidget } from '@txid/react'

export default function App() {
  return (
    <>
      <YourApp />
      <TxIDWidget apiKey="YOUR_KEY" />
    </>
  )
}`}</code></pre>

      <h2>4. You&apos;re live</h2>
      <p>
        The widget is active as soon as the embed code loads. Your users will see a floating chat button.
        Clicking it opens the support widget with your branding applied.
      </p>

      <div className="not-prose mt-8 rounded-xl border border-accent/20 bg-accent/5 p-5">
        <p className="text-sm font-semibold text-white">Next step</p>
        <p className="mt-1 text-sm text-[#a1a1aa]">
          Add your smart contracts so users can check token lock status, liquidity, and more directly in the chat.
        </p>
        <a href="/docs/contracts" className="mt-3 inline-flex items-center text-sm font-medium text-accent hover:underline">
          Smart Contracts guide →
        </a>
      </div>
    </article>
  )
}
