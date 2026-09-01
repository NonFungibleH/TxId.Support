import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

/**
 * Every self-authenticating API endpoint must bypass Clerk, or it is
 * unreachable by the clients it exists for.
 *
 * This test exists because /api/v1/resolve shipped without its middleware
 * entry: it validated a secret key perfectly well, and Clerk intercepted the
 * request before it ever ran. The failure is invisible in the route's own code
 * and invisible in the browser, because a dashboard session sails through.
 *
 * The inverse matters just as much: a dashboard-only route listed here would
 * be public to the internet. Both directions are asserted.
 */
// Resolved from THIS FILE, not process.cwd(): cwd depends on how vitest was
// invoked, so a cwd-relative path made the guard pass from apps/app and fail
// from the repo root. A test that depends on its invocation is not a guard.
const here = dirname(fileURLToPath(import.meta.url))
const middleware = readFileSync(join(here, "..", "..", "middleware.ts"), "utf8")
const block = middleware.slice(
  middleware.indexOf("createRouteMatcher(["),
  middleware.indexOf("]);", middleware.indexOf("createRouteMatcher([")),
)
// Parse the actual QUOTED entries. A first version searched the raw text and
// passed on a comment that merely mentioned a route, which is a test that
// cannot fail: exactly the kind that lets the bug through twice.
const entries = [...block.matchAll(/"([^"]+)"/g)].map(m => m[1]!)
const isPublic = (route: string) => entries.some(e => e.startsWith(route))

describe("middleware public routes", () => {
  it.each([
    ["/api/v1/diagnose", "secret key bearer token"],
    ["/api/v1/resolve", "secret key bearer token"],
    ["/api/v1/identity", "secret key bearer token"],
    ["/api/v1/status", "secret key bearer token"],
    ["/api/chat", "publishable key plus origin guard"],
    ["/api/telegram", "Telegram secret-token header"],
    ["/api/stripe", "webhook signature"],
  ])("%s bypasses Clerk (it authenticates itself: %s)", route => {
    expect(isPublic(route)).toBe(true)
  })

  it.each([
    ["/api/conversations", "dashboard-only, must stay behind Clerk"],
    ["/api/console/audit", "writes the access log as the signed-in actor"],
  ])("%s stays protected (%s)", route => {
    expect(isPublic(route)).toBe(false)
  })
})
