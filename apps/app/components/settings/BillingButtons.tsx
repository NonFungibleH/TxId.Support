"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CreditCard, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { createCheckoutSession, createPortalSession } from "@/lib/actions/billing"

/**
 * "Get Pro" button. When Stripe is configured it starts a Checkout session
 * and redirects; otherwise it falls back to the mailto link so the page
 * still works before billing is wired up.
 */
export function CheckoutButton({
  stripeEnabled,
  fallbackHref,
  label,
  className,
  withIcon = true,
}: {
  stripeEnabled: boolean
  fallbackHref: string
  label: string
  className?: string
  withIcon?: boolean
}) {
  const [loading, setLoading] = useState(false)

  if (!stripeEnabled) {
    return (
      <a href={fallbackHref} className={className}>
        {withIcon && <Zap className="size-3.5" />}
        {label}
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        try {
          const { url } = await createCheckoutSession()
          window.location.href = url
        } catch (err) {
          setLoading(false)
          toast.error(err instanceof Error ? err.message : "Could not start checkout")
        }
      }}
      className={className}
    >
      {withIcon && <Zap className="size-3.5" />}
      {loading ? "Redirecting…" : label}
    </button>
  )
}

/**
 * "Manage billing" button — opens the Stripe customer portal for an existing
 * subscriber. Falls back to the mailto link when Stripe isn't configured.
 */
export function ManageBillingButton({
  stripeEnabled,
  fallbackHref,
}: {
  stripeEnabled: boolean
  fallbackHref: string
}) {
  const [loading, setLoading] = useState(false)

  if (!stripeEnabled) {
    return (
      <a
        href={fallbackHref}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        <CreditCard className="size-3.5" />
        Contact billing support →
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        try {
          const { url } = await createPortalSession()
          window.location.href = url
        } catch (err) {
          setLoading(false)
          toast.error(err instanceof Error ? err.message : "Could not open billing portal")
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors",
        loading && "opacity-60",
      )}
    >
      <CreditCard className="size-3.5" />
      {loading ? "Opening…" : "Manage billing →"}
    </button>
  )
}
