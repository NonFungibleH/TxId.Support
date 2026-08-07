import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The v2-token shim. Pinned against the real token shape captured from
 * production via /api/whoami on 2026-08-07, when auth().orgId returned null
 * for an active organisation and the org lived in an `o` claim instead:
 * switching company showed the previous company's data until this existed.
 */
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }))

import { auth } from "@clerk/nextjs/server"
import { orgKey, resolveOrg } from "../clerk-org"

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>

beforeEach(() => mockAuth.mockReset())

describe("resolveOrg", () => {
  it("trusts the SDK when it already parsed the org", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_1", orgId: "org_sdk", orgSlug: "acme", orgRole: "admin", sessionClaims: {},
    })
    expect(await resolveOrg()).toEqual({
      userId: "user_1", orgId: "org_sdk", orgSlug: "acme", orgRole: "admin",
    })
  })

  it("falls back to the v2 token's `o` claim when the SDK reports no org", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_1", orgId: null, orgSlug: null, orgRole: null,
      sessionClaims: { v: 2, o: { id: "org_3Hasecr", rol: "admin", slg: "yamata-pm" } },
    })
    expect(await resolveOrg()).toEqual({
      userId: "user_1", orgId: "org_3Hasecr", orgSlug: "yamata-pm", orgRole: "admin",
    })
  })

  it("no org anywhere genuinely means the personal workspace", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_1", orgId: null, orgSlug: null, orgRole: null, sessionClaims: {},
    })
    expect(await resolveOrg()).toEqual({
      userId: "user_1", orgId: null, orgSlug: null, orgRole: null,
    })
  })
})

describe("orgKey", () => {
  it("keys tenant rows on the org when active, else the user id", async () => {
    mockAuth.mockResolvedValue({
      userId: "user_1", orgId: null, orgSlug: null, orgRole: null,
      sessionClaims: { o: { id: "org_9" } },
    })
    expect((await orgKey()).orgKey).toBe("org_9")

    mockAuth.mockResolvedValue({
      userId: "user_1", orgId: null, orgSlug: null, orgRole: null, sessionClaims: {},
    })
    expect((await orgKey()).orgKey).toBe("user_1")
  })

  it("throws on no session rather than keying rows on undefined", async () => {
    mockAuth.mockResolvedValue({
      userId: null, orgId: null, orgSlug: null, orgRole: null, sessionClaims: {},
    })
    await expect(orgKey()).rejects.toThrow("Unauthenticated")
  })
})
