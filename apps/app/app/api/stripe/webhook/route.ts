import { getStripe, planFromSubStatus } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Json } from "@/lib/supabase/types"
import { log } from "@/lib/logger"
import type Stripe from "stripe"

// The DB check constraint on organisations.stripe_subscription_status only
// allows this set; Stripe emits a few extra terminal states we coerce to
// "canceled" so the write never violates the constraint.
const ALLOWED_STATUSES = new Set(["active", "past_due", "canceled", "trialing", "incomplete"])

type SupabaseClient = ReturnType<typeof createServiceClient>

/**
 * Reconcile one Stripe subscription into our data model:
 *   - organisations: record subscription id + status (by stripe_customer_id)
 *   - projects.config.plan: pro while active/trialing/past_due, else free
 * The webhook is the ONLY writer of config.plan for paid tiers, so billing
 * state can never drift from what Stripe says the customer actually holds.
 */
async function syncSubscription(
  supabase: SupabaseClient,
  customerId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const plan = planFromSubStatus(sub.status)
  const dbStatus = ALLOWED_STATUSES.has(sub.status) ? sub.status : "canceled"

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()

  if (!org) return // customer we don't recognise — nothing to update

  await supabase
    .from("organisations")
    .update({ stripe_subscription_id: sub.id, stripe_subscription_status: dbStatus } as never)
    .eq("id", (org as { id: string }).id)

  const { data: projects } = await supabase
    .from("projects")
    .select("id, config")
    .eq("org_id", (org as { id: string }).id)

  for (const p of (projects ?? []) as { id: string; config: unknown }[]) {
    const config = (p.config ?? {}) as ProjectConfig
    const updated = { ...config, plan }
    await supabase
      .from("projects")
      .update({ config: updated as unknown as Json })
      .eq("id", p.id)
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return new Response("Stripe webhook not configured", { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing signature", { status: 400 })
  }

  // Raw body is required for signature verification — do NOT JSON.parse first.
  const body = await request.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret)
  } catch (err) {
    log.error("Stripe webhook signature verification failed", err, {
      event: "stripe.webhook.bad_signature",
    })
    return new Response("Invalid signature", { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id
        const subId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id
        if (customerId && subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          await syncSubscription(supabase, customerId, sub)
        }
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id
        await syncSubscription(supabase, customerId, sub)
        break
      }
      default:
        break // ignore other events
    }
  } catch (err) {
    log.error("Stripe webhook handler error", err, {
      event: "stripe.webhook.handler_error",
      stripeEventType: event.type,
    })
    // 500 so Stripe retries — a transient DB blip shouldn't lose the event.
    return new Response("Handler error", { status: 500 })
  }

  log.info("Stripe webhook processed", { event: "stripe.webhook.ok", stripeEventType: event.type })
  return new Response("OK", { status: 200 })
}
