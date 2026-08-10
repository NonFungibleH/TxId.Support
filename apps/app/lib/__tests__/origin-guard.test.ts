import { describe, expect, it } from "vitest"
import { originAllowed } from "../origin-guard"

const req = (origin?: string) =>
  new Request("https://app.txid.support/api/chat", {
    headers: origin ? { origin } : {},
  })

describe("originAllowed", () => {
  it("an unset list stays OPEN, so adding the guard never took a live widget down", () => {
    expect(originAllowed(req("https://anything.example"), [])).toBe(true)
    expect(originAllowed(req("https://anything.example"), undefined)).toBe(true)
  })

  it("once set, only the listed hosts pass", () => {
    const allowed = ["app.yamata.pm"]
    expect(originAllowed(req("https://app.yamata.pm"), allowed)).toBe(true)
    expect(originAllowed(req("https://attacker.example"), allowed)).toBe(false)
  })

  it("subdomains are NOT implied by the parent domain", () => {
    expect(originAllowed(req("https://evil.yamata.pm"), ["yamata.pm"])).toBe(false)
  })

  it("stored entries tolerate the scheme and trailing slash people paste", () => {
    expect(originAllowed(req("https://app.yamata.pm"), ["https://app.yamata.pm/"])).toBe(true)
  })

  it("localhost always passes, so integrators can test", () => {
    expect(originAllowed(req("http://localhost:3000"), ["app.yamata.pm"])).toBe(true)
  })

  it("public surfaces and preview bypass the list by design", () => {
    expect(originAllowed(req("https://x.example"), ["a.com"], { publicSurface: true })).toBe(true)
    expect(originAllowed(req("https://x.example"), ["a.com"], { preview: true })).toBe(true)
  })

  it("a missing Origin header is not treated as abuse", () => {
    // Server-to-server and privacy-stripped callers send none. Blocking them
    // would break real integrations; the rate limiter carries that weight.
    expect(originAllowed(req(), ["app.yamata.pm"])).toBe(true)
  })

  it("port and path on the request origin do not defeat the match", () => {
    expect(originAllowed(req("https://app.yamata.pm:443/some/path"), ["app.yamata.pm"])).toBe(true)
  })

  it("ignores our own origin, which is what the widget iframe always sends", () => {
    // THE OUTAGE THIS ENCODES: the widget is served from app.txid.support and
    // fetches /api/chat and /api/tickets same-origin, so Origin is always ours.
    // Treating that as the embedding site meant the first customer to set a
    // domain silently broke their own widget.
    const req = new Request("https://app.txid.support/api/tickets", {
      headers: { origin: "https://app.txid.support" },
    })
    expect(originAllowed(req, ["app.yamata.pm"])).toBe(true)
  })

  it("ignores our own origin when it arrives as a REFERER, which is the GET case", () => {
    // Verified in a live browser: a same-origin fetch sends NO Origin header
    // and a Referer of the page's own URL. The config fetch is a same-origin
    // GET, so referer was the only header present and the route's own inline
    // copy of this check read it as the embedding site. The first customer to
    // set a domain would have got "Domain not registered for this key" and a
    // widget that never loaded, from doing what the dashboard asked.
    const req = new Request("https://app.txid.support/api/widget-config/pk_1", {
      headers: { referer: "https://app.txid.support/widget?key=pk_1" },
    })
    expect(originAllowed(req, ["app.yamata.pm"])).toBe(true)
    expect(originAllowed(req, ["app.yamata.pm"], { hostPage: "https://app.yamata.pm" })).toBe(true)
    expect(originAllowed(req, ["app.yamata.pm"], { hostPage: "https://copycat.example" })).toBe(false)
  })

  it("checks the host page the embed reports, not the iframe's origin", () => {
    const req = new Request("https://app.txid.support/api/tickets", {
      headers: { origin: "https://app.txid.support" },
    })
    expect(originAllowed(req, ["app.yamata.pm"], { hostPage: "https://app.yamata.pm/portfolio" })).toBe(true)
    expect(originAllowed(req, ["app.yamata.pm"], { hostPage: "https://copycat.example/x" })).toBe(false)
  })
})
