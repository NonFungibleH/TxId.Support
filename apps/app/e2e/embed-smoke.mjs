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
  const post = msg => page.evaluate(m => window.postMessage(m, "*"), msg)
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
} finally {
  await browser.close()
  server.close()
}

if (failed > 0) { console.error(`${failed} assertion(s) failed`); process.exit(1) }
console.log("embed smoke: all green")
