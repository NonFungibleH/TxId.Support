// Activation flow, end to end: the REAL loader and the REAL widget, served by a
// running app dev server, with only the config and readiness APIs answered by
// fixtures. It is the one test that exercises useActivation inside WidgetApp:
// a new wallet detected on the host page gets the prompt, the prompt opens the
// checklist, the chat takes the wallet, and the network item never swaps the
// wallet's real chain for the protocol's.
//
// Needs the app dev server on :3001. No real keys are needed; placeholders do:
//   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k CLERK_SECRET_KEY=sk_test_x pnpm --filter @txid/app dev
//   pnpm --filter @txid/app run smoke:activation
//
// Requests are forwarded with `accept: */*` because Clerk's development
// handshake redirects HTML page requests to the (placeholder) Clerk domain.
// Not in CI: it needs the dev server.
import { chromium } from "playwright"
import { createServer } from "node:http"
const out = process.argv[2] ?? null
const UP = "http://127.0.0.1:3001"
const KEY = "pk_demo_activation"
const WALLET = "0x2222222222222222222222222222222222222222"
const calls = []
const config = {
  projectId: "demo", projectName: "Lumen Finance", mode: "support", chains: ["0xa86a"], token: null,
  branding: { primaryColor: "#6366f1", secondaryColor: "#1e1e2e", backgroundColor: "#0a0a0f", textColor: "#f4f4f5", font: "inter", logoUrl: null, position: "bottom-right", theme: "dark", persona: "friendly" },
  watchedContracts: [], suggestedQuestions: [], contentBlocks: [], hidePoweredBy: true, actions: { enabled: false }, subaccounts: { enabled: false },
  beta: null, statusNotice: null, disclaimer: "", welcomeMessage: null,
  activation: { mode: "prompt", action: "deposit" },
}
const readiness = {
  arm: "shown", state: "new", action: "deposit", guideUrl: "https://example.com/start",
  checklist: {
    headline: "Two things to sort before your first deposit", ready: 1, checkable: 3, todo: 2,
    items: [
      { id: "gas", status: "ready", title: "You have AVAX for network fees" },
      { id: "network", status: "todo", title: "Switch your wallet to Avalanche", detail: "Your wallet is on Ethereum. Lumen Finance runs on Avalanche." },
      { id: "asset", status: "todo", title: "Your USDC is on Arbitrum", detail: "It needs to be on Avalanche to deposit here." },
    ],
  },
}
const harness = `<!doctype html><html><body style="margin:0;background:#222;color:#eee;font-family:sans-serif;height:100vh">
<h1 style="padding:40px">Host dApp</h1>
<script>window.ethereum={request:({method})=>method==="eth_accounts"?Promise.resolve(["${WALLET}"]):method==="eth_chainId"?Promise.resolve("0x1"):Promise.reject(new Error(method)),on:()=>{}}</script>
<script id="txid-widget-script" src="/widget.js" data-key="${KEY}"></script></body></html>`
const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://x")
  calls.push(u.pathname + u.search)
  if (u.pathname === "/") return res.writeHead(200, { "Content-Type": "text/html" }).end(harness)
  if (u.pathname.startsWith("/api/widget-config/")) return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(config))
  if (u.pathname === "/api/widget/readiness") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(readiness))
  if (u.pathname === "/api/widget/activation-event") { let b = ""; req.on("data", c => b += c); req.on("end", () => { calls.push("EVENT " + b); res.writeHead(204).end() }); return }
  if (u.pathname.startsWith("/api/widget/")) return res.writeHead(204).end()
  try {
    const r = await fetch(UP + u.pathname + u.search, { headers: { accept: "*/*" }, redirect: "manual" })
    const body = Buffer.from(await r.arrayBuffer())
    const h = Object.fromEntries(r.headers.entries()); delete h["content-encoding"]; delete h["content-length"]; delete h["transfer-encoding"]
    res.writeHead(r.status, h).end(body)
  } catch (e) { res.writeHead(502).end(String(e)) }
})
await new Promise(r => server.listen(0, r))
const port = server.address().port
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
p.on("pageerror", e => errs.push("host " + e))
let failed = 0
const check = (n, ok, d = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  " + d}`); if (!ok) failed++ }
await p.goto(`http://localhost:${port}/`, { waitUntil: "load" })
await p.waitForSelector("#txid-widget-nudge", { timeout: 90000 }).catch(() => {})
const nudge = await p.evaluate(() => document.getElementById("txid-widget-nudge")?.textContent ?? null)
check("prompt appears for a new wallet detected on the host page", !!nudge && nudge.includes("first deposit"), String(nudge))
const rq = calls.find(c => c.startsWith("/api/widget/readiness"))
check("readiness was asked about the host wallet and its chain", !!rq && rq.includes(WALLET) && rq.includes("chainId=0x1"), String(rq))
check("the prompt was recorded once", calls.filter(c => c.includes('"prompted"')).length === 1, calls.filter(c => c.startsWith("EVENT")).join(" | "))
if (out) await p.screenshot({ path: `${out}/e2e-prompt.png` })
await p.click("#txid-widget-nudge button:not(.txid-nudge-x)")
await p.waitForTimeout(1200)
const frame = p.frames().find(f => f.url().includes("/widget?"))
const panelText = await frame.evaluate(() => document.querySelector('[aria-label="Wallet readiness check"]')?.textContent ?? null)
check("clicking it opens the checklist inside the widget", !!panelText && panelText.includes("Two things to sort before your first deposit"), String(panelText).slice(0, 120))
check("opening was recorded", calls.some(c => c.includes('"opened"')), "")
if (out) await p.screenshot({ path: `${out}/e2e-open.png` })
const header = await frame.evaluate(() => document.body.innerText.includes("Connect wallet"))
check("opening the checklist gives the chat the same wallet", !header, "header still offers Connect wallet")
await p.waitForTimeout(1500)
const rqs = calls.filter(c => c.startsWith("/api/widget/readiness"))
check("every readiness call used the wallet's real network, never the protocol's", rqs.length > 0 && rqs.every(c => c.includes("chainId=0x1")), rqs.join(" | "))
await frame.click("text=Ask a question")
await p.waitForTimeout(500)
const pill = await frame.evaluate(() => Array.from(document.querySelectorAll("button")).some(b => b.textContent.includes("See your checklist")))
check("back in the chat, the checklist stays one tap away", pill, "")
if (out) await p.screenshot({ path: `${out}/e2e-chat.png` })
console.log(JSON.stringify({ hostErrors: errs.slice(0, 5) }))
await b.close(); server.close()
if (failed) process.exit(1)
