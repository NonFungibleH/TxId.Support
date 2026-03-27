import type { Metadata } from "next"

export const metadata: Metadata = { title: "API Reference" }

function Method({ method, path, badge }: { method: string; path: string; badge?: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    OPTIONS: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  }
  return (
    <div className="not-prose flex items-center gap-3 rounded-lg border border-[#1f1f1f] bg-[#111111] px-4 py-3 font-mono text-sm">
      <span className={`rounded border px-2 py-0.5 text-xs font-bold ${colors[method]}`}>{method}</span>
      <span className="text-[#e4e4e7]">{path}</span>
      {badge && <span className="ml-auto rounded-full bg-[#27272a] px-2 py-0.5 text-[10px] text-[#a1a1aa]">{badge}</span>}
    </div>
  )
}

export default function ApiPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 not-prose">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Reference</p>
        <h1 className="text-3xl font-bold text-white">API Reference</h1>
        <p className="mt-2 text-[#a1a1aa]">
          The widget calls these endpoints. All endpoints support CORS from any origin.
        </p>
      </div>

      <h2>Authentication</h2>
      <p>
        All widget-facing endpoints authenticate via your <strong>publishable key</strong> (<code>pk_...</code>)
        passed in the request body or URL. Never use your secret key (<code>sk_...</code>) in frontend code.
      </p>

      <hr />

      <h2>GET /api/widget-config/:key</h2>
      <Method method="GET" path="/api/widget-config/:key" badge="Public" />
      <p>
        Returns the public configuration for a project — branding, chain list, token info, and watched
        contract metadata. Called by the widget on load to apply branding.
      </p>
      <h3>Parameters</h3>
      <ul>
        <li><code>key</code> (path) — your <code>pk_...</code> publishable key</li>
      </ul>
      <h3>Response</h3>
      <pre><code>{`{
  "projectId": "uuid",
  "projectName": "Team Finance",
  "branding": {
    "primaryColor": "#6366f1",
    "secondaryColor": "#4f46e5",
    "backgroundColor": "#0f0f0f",
    "textColor": "#ffffff",
    "font": "Inter",
    "logoUrl": null,
    "position": "bottom-right",
    "theme": "dark"
  },
  "chains": ["0x1", "0x2105"],
  "token": {
    "symbol": "TEAM",
    "chain": "0x1",
    "dexUrl": "https://app.uniswap.org/..."
  },
  "watchedContracts": [
    {
      "id": "abc123",
      "name": "Team Finance Lock",
      "address": "0x1234...abcd",
      "chain": "0x1",
      "description": "Token lock contract..."
    }
  ]
}`}</code></pre>

      <hr />

      <h2>POST /api/chat</h2>
      <Method method="POST" path="/api/chat" badge="Streaming SSE" />
      <p>
        Streams a Claude AI response for a conversation. Uses RAG to retrieve relevant documentation
        context, then builds a system prompt that includes token info, watched contracts, and wallet
        context before streaming.
      </p>
      <h3>Request body</h3>
      <pre><code>{`{
  "key": "pk_...",
  "sessionId": "unique-session-id",
  "messages": [
    { "role": "user", "content": "Is my token locked?" }
  ],
  "walletAddress": "0xabc...",  // optional
  "chainId": "0x1"              // optional
}`}</code></pre>
      <h3>Response</h3>
      <p>
        Server-Sent Events stream. Each event is a JSON object on a <code>data:</code> line:
      </p>
      <pre><code>{`data: {"text": "I checked the "}\n\n
data: {"text": "Team Finance lock "}\n\n
data: {"text": "contract and your token is locked until 2026."}\n\n
data: [DONE]\n\n`}</code></pre>
      <p>
        On error: <code>{`data: {"error": "message"}`}</code>
      </p>
      <h3>Rate limits</h3>
      <p>
        Rate limiting is per project per hour. Limits vary by plan. Exceeding the limit returns a
        <code>429</code> status.
      </p>
    </article>
  )
}
