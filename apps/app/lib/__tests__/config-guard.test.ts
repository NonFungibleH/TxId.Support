import { describe, expect, it } from "vitest"
import { stripServerOwnedKeys, SERVER_OWNED_CONFIG_KEYS } from "../config-guard"

/**
 * updateConfig is a server action, i.e. a POST endpoint, and its typed argument
 * is not enforced at runtime. These tests pin the privilege boundary: a caller
 * cannot smuggle a plan upgrade or a publicDemo flip through a config save.
 */
describe("stripServerOwnedKeys", () => {
  it("removes a self-granted plan upgrade", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = stripServerOwnedKeys({ plan: "enterprise", branding: { primaryColor: "#000" } } as any)
    expect("plan" in out).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((out as any).branding).toEqual({ primaryColor: "#000" })
  })

  it("removes a self-granted publicDemo flip", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect("publicDemo" in stripServerOwnedKeys({ publicDemo: true } as any)).toBe(false)
  })

  it("leaves ordinary config untouched", () => {
    const partial = { docsUrl: "https://x.com", telegramBotToken: "abc" }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(stripServerOwnedKeys(partial as any)).toEqual(partial)
  })

  it("does not mutate its input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = { plan: "custom" } as any
    stripServerOwnedKeys(input)
    expect(input.plan).toBe("custom")
  })

  it("guards both known server-owned keys", () => {
    expect([...SERVER_OWNED_CONFIG_KEYS].sort()).toEqual(["plan", "publicDemo"])
  })
})
