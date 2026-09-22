// Embed smoke: drives public/widget.js in a real Chromium against the beta
// arrival's full choreography. Exists because the spotlight shipped broken
// twice in one day through paths reading-the-code missed (a stale close
// handler; a truncated grep), and both were caught only when a browser
// actually ran it. Run with: pnpm --filter @txid/app run smoke:embed
//
// Deliberately a plain node script, not a test-runner project: one file, no
// config, exits non-zero on the first failed assertion.

import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const here = dirname(fileURLToPath(import.meta.url))
const files = {
  "/": { path: join(here, "harness/index.html"), type: "text/html" },
  "/index.html": { path: join(here, "harness/index.html"), type: "text/html" },
  "/widget.js": { path: join(here, "../public/widget.js"), type: "text/javascript" },
}

const server = createServer(async (req, res) => {
  const f = files[req.url.split("?")[0]]
  if (!f) { res.writeHead(404).end(); return }
  res.writeHead(200, { "Content-Type": f.type }).end(await readFile(f.path))
})
await new Promise(r => server.listen(0, r))
const port = server.address().port

let failed = 0
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`)
  if (!ok) failed++
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(`http://localhost:${port}/`)

  const state = () => page.evaluate(() => {
    const wrap = document.getElementById("txid-widget-frame-wrap")
    const r = wrap.getBoundingClientRect()
    return {
      classes: wrap.className,
      open: wrap.className.includes("open"),
      centred: wrap.className.includes("txid-center") &&
        Math.abs((r.left + r.width / 2) - innerWidth / 2) < 25,
      corner: Math.abs(innerWidth - r.right - 24) < 10 && Math.abs(innerHeight - r.bottom - 92) < 10,
      backdrop: !!document.getElementById("txid-widget-backdrop"),
      caption: !!document.getElementById("txid-widget-caption"),
    }
  })
  // Post from INSIDE the widget iframe, not the top window: the loader now
  // authenticates messages by origin AND source (a co-resident script must not
  // be able to impersonate the iframe), so the harness has to speak as the
  // iframe itself, exactly like the real widget does. The iframe's /widget URL
  // 404s in this harness, but its window + origin (== BASE) are real.
  const post = msg => {
    const frame = page.frames().find(f => f.url().includes("/widget"))
    if (!frame) throw new Error("widget iframe frame not found")
    return frame.evaluate(m => window.parent.postMessage(m, "*"), msg)
  }
  const freshSpotlight = async () => {
    await page.evaluate(() => {
      sessionStorage.clear()
      document.getElementById("txid-widget-caption")?.remove()
    })
    await post("txid-autoopen")
    await page.waitForTimeout(150)
  }

  // A: spotlight, then first message -> auto-dock, caption, stays open
  await freshSpotlight()
  let s = await state()
  check("spotlight centres with backdrop", s.centred && s.backdrop && s.open, JSON.stringify(s))
  await post("txid-engaged")
  await page.waitForTimeout(800)
  s = await state()
  check("first message docks to corner with caption", s.corner && s.caption && s.open && !s.backdrop, JSON.stringify(s))

  // B: spotlight, then Let's go -> dock and close, caption stays
  await post("txid-close"); await page.waitForTimeout(400)
  await freshSpotlight()
  await post("txid-letsgo")
  await page.waitForTimeout(1200)
  s = await state()
  check("Let's go closes cleanly with caption", !s.open && !s.backdrop && s.caption && !s.classes.includes("txid-center"), JSON.stringify(s))

  // C: spotlight, X-close mid-spotlight -> full cleanup, reopen is corner
  await freshSpotlight()
  await post("txid-close"); await page.waitForTimeout(400)
  s = await state()
  check("X-close mid-spotlight cleans up", !s.open && !s.backdrop && !s.classes.includes("txid-center"), JSON.stringify(s))
  await page.click("#txid-widget-btn"); await page.waitForTimeout(150)
  s = await state()
  check("reopen is corner, never centred", s.open && s.corner && !s.classes.includes("txid-center"), JSON.stringify(s))

  // ── Readiness check (activation) ───────────────────────────────────────────
  // What the loader sends INTO the frame, recorded from inside the frame.
  await post("txid-close"); await page.waitForTimeout(400)
  const frame = page.frames().find(f => f.url().includes("/widget"))
  await frame.evaluate(() => {
    window.__got = []
    window.addEventListener("message", e => { if (e.data && e.data.type) window.__got.push(e.data) })
  })
  const got = () => frame.evaluate(() => window.__got.map(m => m.type))
  const clearGot = () => frame.evaluate(() => { window.__got = [] })
  const nudgeShown = () => page.evaluate(() => !!document.getElementById("txid-widget-nudge"))
  const panelOpen = () => page.evaluate(() => document.getElementById("txid-widget-frame-wrap").className.includes("open"))

  // A fake injected wallet that records every method it is asked for.
  await page.evaluate(() => {
    window.__calls = []
    window.ethereum = {
      request: ({ method }) => {
        window.__calls.push(method)
        if (method === "eth_accounts") return Promise.resolve(["0x1111111111111111111111111111111111111111"])
        if (method === "eth_chainId") return Promise.resolve("0xa86a")
        return Promise.reject(new Error("unexpected " + method))
      },
      on: () => {},
    }
  })
  await post("txid-ready"); await page.waitForTimeout(150)
  await page.evaluate(() => window.txid.notifyFailure("0x" + "ab".repeat(32)))
  await page.waitForTimeout(300)
  let calls = await page.evaluate(() => window.__calls)
  check("loader touches no wallet until the frame asks", calls.length === 0 && !(await got()).includes("txid-failure"), JSON.stringify({ calls, got: await got() }))

  await post({ type: "txid-activation-watch" }); await page.waitForTimeout(300)
  calls = await page.evaluate(() => window.__calls)
  const wallet = await frame.evaluate(() => window.__got.find(m => m.type === "txid-host-wallet"))
  check("host wallet is read silently and reported", !!wallet && wallet.address === "0x1111111111111111111111111111111111111111" && wallet.chainId === "0xa86a" && !calls.includes("eth_requestAccounts"), JSON.stringify({ calls, wallet }))
  check("a failure reported before the frame asked is delivered once it does", (await got()).includes("txid-failure"), JSON.stringify(await got()))

  await clearGot()
  await post({ type: "txid-nudge", text: "Getting started? Check your wallet is ready for your first deposit." })
  await page.waitForTimeout(400)
  check("prompt appears beside the launcher", await nudgeShown(), "")
  await page.click("#txid-widget-nudge .txid-nudge-x"); await page.waitForTimeout(400)
  check("dismiss removes the prompt and tells the frame", !(await nudgeShown()) && (await got()).includes("txid-nudge-dismissed") && !(await panelOpen()), JSON.stringify(await got()))

  await clearGot()
  await post({ type: "txid-nudge", text: "Getting started? Check your wallet is ready for your first deposit." })
  await page.waitForTimeout(400)
  await page.click("#txid-widget-nudge button:not(.txid-nudge-x)"); await page.waitForTimeout(500)
  check("clicking the prompt opens the checklist", (await panelOpen()) && !(await nudgeShown()) && (await got()).includes("txid-show-checklist"), JSON.stringify(await got()))

  await post({ type: "txid-nudge", text: "Anything" }); await page.waitForTimeout(300)
  check("no prompt over an open panel", !(await nudgeShown()), "")
  await post("txid-close"); await page.waitForTimeout(400)

  // Open-once must never drop the panel over someone typing into the host page.
  await clearGot()
  await page.evaluate(() => {
    const i = document.createElement("input"); i.id = "amount"; document.body.appendChild(i); i.focus()
  })
  await post({ type: "txid-open-checklist", text: "Getting started?" }); await page.waitForTimeout(1600)
  check("open-once while typing prompts instead of opening", !(await panelOpen()) && (await nudgeShown()), JSON.stringify(await got()))
  await page.evaluate(() => { document.getElementById("amount").blur(); document.getElementById("txid-widget-nudge")?.remove() })
  await post({ type: "txid-nudge-clear" }); await page.waitForTimeout(400)

  await clearGot()
  await post({ type: "txid-open-checklist", text: "Getting started?" }); await page.waitForTimeout(1600)
  check("open-once when idle opens on the checklist", (await panelOpen()) && (await got()).includes("txid-show-checklist"), JSON.stringify(await got()))
} finally {
  await browser.close()
  server.close()
}

if (failed > 0) { console.error(`${failed} assertion(s) failed`); process.exit(1) }
console.log("embed smoke: all green")
