import type { Metadata } from "next"

export const metadata: Metadata = { title: "Embed Options" }

export default function EmbedPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 not-prose">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Integration</p>
        <h1 className="text-3xl font-bold text-white">Embed Options</h1>
        <p className="mt-2 text-[#a1a1aa]">Three ways to embed the support widget on your site.</p>
      </div>

      <p>
        Your publishable API key (<code>pk_...</code>) is safe to expose in frontend code — it only
        identifies your project. Never expose your <code>sk_...</code> secret key publicly.
      </p>

      <h2>Option 1 — Script tag</h2>
      <p>
        The simplest integration. Paste this snippet before the closing <code>&lt;/body&gt;</code> tag
        on any HTML page.
      </p>
      <pre><code>{`<script>
  (function(){
    var f = document.createElement('iframe');
    f.src = "https://app.txid.support/widget?key=pk_YOUR_KEY";
    f.allow = "clipboard-write";
    f.style.cssText = [
      "position:fixed",
      "bottom:20px",
      "right:20px",
      "width:380px",
      "height:580px",
      "border:none",
      "z-index:2147483647",
      "border-radius:16px",
      "box-shadow:0 8px 32px rgba(0,0,0,0.4)"
    ].join(";");
    document.body.appendChild(f);
  })();
</script>`}</code></pre>

      <p>
        To position bottom-left, change <code>right:20px</code> to <code>left:20px</code>.
      </p>

      <h2>Option 2 — Inline iframe</h2>
      <p>
        Embed the widget inline inside any container on your page — useful for a dedicated support page
        or sidebar panel.
      </p>
      <pre><code>{`<iframe
  src="https://app.txid.support/widget?key=pk_YOUR_KEY"
  style="width:100%;height:580px;border:none;border-radius:16px;"
  allow="clipboard-write"
  loading="lazy">
</iframe>`}</code></pre>

      <h2>Option 3 — React component</h2>
      <p>
        Install the <code>@txid/react</code> package for a first-class React integration with a
        managed toggle button and open/close state.
      </p>
      <pre><code>{`npm install @txid/react`}</code></pre>
      <pre><code>{`import { TxIDWidget } from '@txid/react'

export default function App() {
  return (
    <>
      <YourApp />
      <TxIDWidget
        apiKey="pk_YOUR_KEY"
        position="bottom-right"
        defaultOpen={false}
      />
    </>
  )
}`}</code></pre>

      <h3>TxIDWidget props</h3>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#27272a]">
              <th className="py-2 pr-4 text-left font-semibold text-white">Prop</th>
              <th className="py-2 pr-4 text-left font-semibold text-white">Type</th>
              <th className="py-2 pr-4 text-left font-semibold text-white">Default</th>
              <th className="py-2 text-left font-semibold text-white">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#a1a1aa]">
            {[
              ["apiKey", "string", "required", "Your pk_... publishable key"],
              ["position", '"bottom-right" | "bottom-left"', '"bottom-right"', "FAB position"],
              ["defaultOpen", "boolean", "false", "Open the widget on mount"],
              ["baseUrl", "string", '"https://app.txid.support"', "Override for self-hosted"],
            ].map(([prop, type, def, desc]) => (
              <tr key={prop} className="border-b border-[#1f1f1f]">
                <td className="py-2 pr-4 font-mono text-xs text-[#e4e4e7]">{prop}</td>
                <td className="py-2 pr-4 font-mono text-xs text-indigo-400">{type}</td>
                <td className="py-2 pr-4 font-mono text-xs">{def}</td>
                <td className="py-2 text-xs">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Domain whitelisting</h2>
      <p>
        In the dashboard under <strong>Embed</strong>, you can add allowed domains. Requests from
        unlisted origins will be rejected. Leave empty to allow all domains (fine for development,
        not recommended for production).
      </p>
    </article>
  )
}
