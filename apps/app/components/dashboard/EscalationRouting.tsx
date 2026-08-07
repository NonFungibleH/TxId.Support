"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight, Route } from "lucide-react"
import { updateConfig } from "@/lib/actions/project"
import { IntegrationsForm, type IntegrationsStatus } from "@/components/settings/IntegrationsForm"

interface EscalationRoutingProps {
  projectId: string
  notificationEmail: string
  webhookUrl: string
  integrations: IntegrationsStatus
}

// Where escalations go, all in one place: email + webhook + the channel/tracker
// integrations. Lives at the top of the Tickets page as a collapsed dropdown so
// the ticket inbox stays the focus. It stays collapsed even when nothing is set
// up: eight configuration cards pushing the inbox off screen is a worse first
// impression than one line saying it needs attention, which the header already
// does. Setup is a once-ever task; reading tickets is not.
export function EscalationRouting({ projectId, notificationEmail, webhookUrl, integrations }: EscalationRoutingProps) {
  const [email, setEmail] = useState(notificationEmail)
  const [webhook, setWebhook] = useState(webhookUrl)
  const [isPending, startTransition] = useTransition()

  // Load-time summary of active routes (refreshes on reload after a save).
  const activeRoutes: string[] = [
    notificationEmail ? "Email" : null,
    webhookUrl ? "Webhook" : null,
    integrations.slack.enabled && integrations.slack.configured ? "Slack" : null,
    integrations.discord.enabled && integrations.discord.configured ? "Discord" : null,
    integrations.telegram.enabled && integrations.telegram.botConnected ? "Telegram" : null,
    integrations.linear.enabled && integrations.linear.configured ? "Linear" : null,
    integrations.github.enabled && integrations.github.configured ? "GitHub" : null,
    integrations.jira.enabled && integrations.jira.configured ? "Jira" : null,
  ].filter((x): x is string => x !== null)

  const [open, setOpen] = useState(false)

  function saveEmail() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { notificationEmail: email || null })
        toast.success("Notification email saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  function saveWebhook() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { webhookUrl: webhook || null })
        toast.success("Webhook URL saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Route className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Escalation routing</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeRoutes.length > 0
                ? `Active: ${activeRoutes.join(", ")}`
                : "Not set up yet: raised tickets aren't being sent anywhere. Open to configure."}
            </p>
          </div>
        </div>
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            When a support ticket is raised, send it where your team works. Notify a channel and open a tracked issue automatically.
          </p>

          {/* Email */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Email notifications</p>
              {/* DO NOT name the env var here. Whether OUR mail provider is
                  configured is our problem, not the customer's, and a variable
                  they cannot set reads as a broken feature. Roadmap
                  `k-email-status` covers surfacing the real state. */}
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified when a new ticket is raised.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="team@yourprotocol.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={saveEmail} disabled={isPending}>
                Save
              </Button>
            </div>
          </div>

          {/* Webhook */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Escalation webhook</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                POST request sent to your URL when a ticket is created, for your own systems.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={webhook}
                onChange={e => setWebhook(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={saveWebhook} disabled={isPending}>
                Save
              </Button>
            </div>
          </div>

          {/* Channel + issue-tracker integrations */}
          <IntegrationsForm initial={integrations} />
        </div>
      )}
    </div>
  )
}
