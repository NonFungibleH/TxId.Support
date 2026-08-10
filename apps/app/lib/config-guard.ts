import type { ProjectConfig } from "@/lib/types/config"

/**
 * Config keys that a dashboard user must never be able to write through
 * `updateConfig`, however they call it.
 *
 * THIS IS A PRIVILEGE BOUNDARY. `updateConfig` is a server action, which is a
 * POST endpoint, and its `Partial<ProjectConfig>` argument type is erased at
 * runtime. Without this strip, any authenticated user holding the `settings`
 * capability could invoke the action directly with `{ plan: "enterprise" }` and
 * self-grant an unlimited, unbilled plan, or `{ publicDemo: true }` to turn
 * their key into a public one and lift its rate caps. Both are written ONLY by
 * server-side paths (the Stripe webhook and the admin actions) that use the
 * service client directly, so nothing legitimate flows through here.
 *
 * Add any new billing-, plan- or trust-bearing config key to this list.
 */
export const SERVER_OWNED_CONFIG_KEYS = ["plan", "publicDemo"] as const

/** Return a copy of the partial with every server-owned key removed. */
export function stripServerOwnedKeys(
  partial: Partial<ProjectConfig>,
): Partial<ProjectConfig> {
  const clean = { ...partial }
  for (const k of SERVER_OWNED_CONFIG_KEYS) {
    delete (clean as Record<string, unknown>)[k]
  }
  return clean
}
