import Stripe from "stripe"
import type { Plan } from "@/lib/types/config"

// Lazy singleton so importing this module never throws when Stripe isn't
// configured (e.g. local dev, or before the keys are set in Vercel).
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured")
  if (!_stripe) _stripe = new Stripe(key)
  return _stripe
}

/** True only when both the secret key and the Pro price ID are set — the
 *  minimum needed to run checkout. The upgrade page uses this to decide
 *  between the live "Get Pro" button and the "email us" fallback. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO)
}

/**
 * Map a Stripe subscription status to our internal plan. `active`,
 * `trialing`, and `past_due` keep Pro access — past_due is Stripe's dunning
 * grace window, during which we don't want to yank the paying customer's
 * features mid-retry. Every terminal state (canceled, unpaid,
 * incomplete_expired) drops to free.
 */
export function planFromSubStatus(status: Stripe.Subscription.Status | string | null | undefined): Plan {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
      return "pro"
    default:
      return "free"
  }
}
