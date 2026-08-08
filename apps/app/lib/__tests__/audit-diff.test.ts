import { describe, it, expect } from "vitest"
import { diffConfig, describeValue } from "../audit"

/**
 * The change history has to survive a reviewer asking "what did they actually
 * do". Every case here is a bug the log shipped with.
 */
describe("describeValue", () => {
  it("does not redact a boolean just because its name contains 'key'", () => {
    // `allowUnrestrictedKey` is a toggle. Redacting it made the change history
    // say "set", which reads like a credential changed and is the opposite of
    // what happened.
    expect(describeValue("allowUnrestrictedKey", true)).toBe("on")
    expect(describeValue("allowUnrestrictedKey", false)).toBe("off")
  })

  it("never records the value of a credential, only whether it exists", () => {
    // The whole reason this table is safe to show a security reviewer.
    expect(describeValue("telegramBotToken", "7654321098:AAEhBG")).toBe("set")
    expect(describeValue("apiKey", "")).toBe("cleared")
    expect(describeValue("webhookUrl", "https://hooks.slack.com/services/T/B/xxx")).toBe("set")
    expect(describeValue("integrationSecret", null)).toBe("cleared")
  })

  it("reads booleans as on and off, which is what the switch actually did", () => {
    expect(describeValue("docsSync", true)).toBe("on")
    expect(describeValue("docsSync", false)).toBe("off")
  })

  it("distinguishes never set from set to empty", () => {
    expect(describeValue("openingMessage", undefined)).toBe("not set")
    expect(describeValue("openingMessage", "")).toBe("empty")
  })

  it("summarises collections instead of dumping them into the log", () => {
    expect(describeValue("allowedDomains", ["a.com", "b.com"])).toBe("2 items")
    expect(describeValue("allowedDomains", ["a.com"])).toBe("1 item")
    expect(describeValue("branding", { primaryColor: "#fff", font: "Inter" }))
      .toBe("{ primaryColor, font }")
  })

  it("truncates long strings rather than storing an essay per row", () => {
    const long = "x".repeat(200)
    const out = describeValue("customTone", long)
    expect(out.length).toBeLessThan(100)
    expect(out.endsWith("…")).toBe(true)
  })
})

describe("diffConfig", () => {
  it("records what a field changed FROM, not just its name", () => {
    // The log used to say "docsSync, docsSync" and nothing else, which cannot
    // tell an auditor whether the switch went on or off.
    expect(diffConfig({ docsSync: false }, { docsSync: true })).toEqual([
      { field: "docsSync", from: "off", to: "on" },
    ])
  })

  it("ignores a save that changed nothing", () => {
    // Debounced forms re-save the same object on every keystroke, which is why
    // four identical rows appeared seconds apart and buried the real changes.
    expect(diffConfig({ docsSync: true }, { docsSync: true })).toEqual([])
    expect(diffConfig({ branding: { font: "Inter" } }, { branding: { font: "Inter" } })).toEqual([])
  })

  it("sees a change inside a nested object", () => {
    const out = diffConfig({ branding: { font: "Inter" } }, { branding: { font: "Mono" } })
    expect(out).toHaveLength(1)
    expect(out[0]!.field).toBe("branding")
  })

  it("reports a field that did not exist before as not set", () => {
    expect(diffConfig({}, { allowUnrestrictedKey: true })).toEqual([
      { field: "allowUnrestrictedKey", from: "not set", to: "on" },
    ])
  })

  it("only reports the fields in the patch, never the whole config", () => {
    const before = { docsSync: true, plan: "free", branding: { font: "Inter" } }
    expect(diffConfig(before, { plan: "pro" })).toEqual([
      { field: "plan", from: "free", to: "pro" },
    ])
  })
})
