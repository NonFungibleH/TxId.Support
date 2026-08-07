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
})
