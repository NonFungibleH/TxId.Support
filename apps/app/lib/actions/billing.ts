"use server"

import { requireCapability } from "@/lib/roles-server"
import { refuse, type ActionResult } from "@/lib/actions/result"

import { resolveOrg as resolveClerkOrg } from "@/lib/clerk-org"
import { createServiceClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"
import type { Database } from "@/lib/supabase/types"

// The Stripe billing columns were added by migration 20260701000001 but the
// generated Supabase types predate it, so we read/write them through a
// widened view rather than the base Row type.
type OrgRow = Database["public"]["Tables"]["organisations"]["Row"]
type OrgWithStripe = OrgRow & {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_subscription_status: string | null
}

async function resolveOrg() {
  const { orgId, userId } = await resolveClerkOrg()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()
  // SELECT, never upsert-with-name. This was a second copy of the bug fixed in
  // project.ts: upserting { name: "My Protocol" } here meant any billing
  // action renamed the organisation back to the placeholder. Billing has no
  // business creating orgs either - by the time anyone can pay, getProject()
  // has long since created the row.
  const { data, error } = await supabase
    .from("organisations")
    .select()
    .eq("clerk_org_id", orgKey)
    .single()

  const org = data as unknown as OrgWithStripe | null
  if (error || !org) throw new Error("Could not resolve organisation")
  return { org, supabase, userId }
}

/**
 * Start a Stripe Checkout session for the Pro plan. Ensures the org has a
 * Stripe customer (creating one on first upgrade), then returns the hosted
 * checkout URL for the client to redirect to. The plan itself is only
 * granted once the webhook receives the completed subscription - never
 * client-side.
 */
export async function createCheckoutSession(): Promise<ActionResult<{ url: string }>> {
  await requireCapability("billing")
  const priceId = process.env.STRIPE_PRICE_PRO
  if (!priceId) return refuse("Card payment is not switched on yet. Email team@txid.support and we will set your plan up directly.")

  const { org, supabase, userId } = await resolveOrg()
  const stripe = getStripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  let customerId = org.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      ...(org.name ? { name: org.name } : {}),
      metadata: { org_id: org.id, clerk_user_id: userId },
    })
    customerId = customer.id
    await supabase
      .from("organisations")
      .update({ stripe_customer_id: customerId } as never)
      .eq("id", org.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/account?checkout=success`,
    cancel_url: `${appUrl}/dashboard/upgrade?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: { org_id: org.id },
    subscription_data: { metadata: { org_id: org.id } },
  })

  if (!session.url) throw new Error("Could not start checkout")
  return { ok: true, url: session.url }
}

/**
 * Open the Stripe billing portal so an existing subscriber can update their
 * card, view invoices, or cancel. Requires an existing Stripe customer.
 */
export async function createPortalSession(): Promise<ActionResult<{ url: string }>> {
  await requireCapability("billing")
  const { org } = await resolveOrg()
  const customerId = org.stripe_customer_id
  if (!customerId) return refuse("There is no billing account on this company yet. Upgrade first and it will appear here.", { label: "See plans", href: "/dashboard/upgrade" })

  const stripe = getStripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/account`,
  })
  return { ok: true, url: session.url }
}
