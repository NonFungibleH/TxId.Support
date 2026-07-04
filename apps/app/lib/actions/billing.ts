"use server"

import { auth } from "@clerk/nextjs/server"
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
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("organisations")
    .upsert({ clerk_org_id: orgKey, name: "My Protocol" }, { onConflict: "clerk_org_id" })
    .select()
    .single()

  const org = data as unknown as OrgWithStripe | null
  if (error || !org) throw new Error("Could not resolve organisation")
  return { org, supabase, userId }
}

/**
 * Start a Stripe Checkout session for the Pro plan. Ensures the org has a
 * Stripe customer (creating one on first upgrade), then returns the hosted
 * checkout URL for the client to redirect to. The plan itself is only
 * granted once the webhook receives the completed subscription — never
 * client-side.
 */
export async function createCheckoutSession(): Promise<{ url: string }> {
  const priceId = process.env.STRIPE_PRICE_PRO
  if (!priceId) throw new Error("Billing is not configured yet")

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
  return { url: session.url }
}

/**
 * Open the Stripe billing portal so an existing subscriber can update their
 * card, view invoices, or cancel. Requires an existing Stripe customer.
 */
export async function createPortalSession(): Promise<{ url: string }> {
  const { org } = await resolveOrg()
  const customerId = org.stripe_customer_id
  if (!customerId) throw new Error("No billing account yet — upgrade first")

  const stripe = getStripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/account`,
  })
  return { url: session.url }
}
