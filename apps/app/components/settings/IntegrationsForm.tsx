"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { saveIntegration, testIntegrationAction } from "@/lib/actions/integrations"
import type { IntegrationTarget } from "@/lib/types/config"
import { MessageSquare, Hash, Send, CheckCircle2, Loader2, ExternalLink } from "lucide-react"

export interface IntegrationsStatus {
  slack: { enabled: boolean; configured: boolean }
  discord: { enabled: boolean; configured: boolean }
  telegram: { enabled: boolean; chatId: string; botConnected: boolean }
  linear: { enabled: boolean; teamId: string; configured: boolean }
  github: { enabled: boolean; repo: string; configured: boolean }
  jira: { enabled: boolean; domain: string; email: string; projectKey: string; configured: boolean }
}

const SECRET_PLACEHOLDER = "•••••••• configured (leave blank to keep)"

function TestButton({ target, disabled }: { target: IntegrationTarget; disabled: boolean }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; msg: string; url?: string } | null>(null)
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await testIntegrationAction(target)
            setResult({ ok: r.ok, msg: r.ok ? "Test sent" : (r.error ?? "Failed"), ...(r.url ? { url: r.url } : {}) })
          })
        }
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Send test"}
      </button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-500" : "text-red-500"}`}>
          {result.msg}
          {result.url && (
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
              view <ExternalLink className="size-2.5" />
            </a>
          )}
        </span>
      )}
    </div>
  )
}

function Card({
  title, icon: Icon, blurb, target, enabled, configured, children, onToggle, onSave, saveDisabled,
}: {
  title: string
  icon: typeof MessageSquare
  blurb: React.ReactNode
  target: IntegrationTarget
  enabled: boolean
  configured?: boolean
  children: React.ReactNode
  onToggle: (v: boolean) => void
  onSave: () => void
  saveDisabled?: boolean
}) {
  const [pending, start] = useTransition()
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{title}</p>
              {configured && <span className="inline-flex items-center gap-1 text-[11px] text-green-500"><CheckCircle2 className="size-3" /> configured</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-md">{blurb}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && (
        <div className="mt-4 space-y-3">
          {children}
          <div className="flex items-center justify-between gap-3 pt-1">
            <TestButton target={target} disabled={!configured} />
            <button
              type="button"
              disabled={pending || saveDisabled}
              onClick={() => start(async () => { onSave(); })}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function IntegrationsForm({ initial }: { initial: IntegrationsStatus }) {
  const [s, setS] = useState(initial)
  // Secret drafts (blank = keep existing). Non-secret fields live in `s`.
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const secret = (k: string) => secrets[k] ?? ""
  const setSecret = (k: string, v: string) => setSecrets(p => ({ ...p, [k]: v }))

  function save(target: IntegrationTarget, patch: Record<string, unknown>) {
    void saveIntegration(target, patch)
      .then(() => toast.success("Saved"))
      .catch(() => toast.error("Failed to save"))
  }

  return (
    <div className="space-y-4">
      {/* Slack */}
      <Card
        title="Slack" icon={Hash} target="slack"
        blurb="Post each new ticket to a Slack channel via an Incoming Webhook."
        enabled={s.slack.enabled} configured={s.slack.configured}
        onToggle={(v) => { setS({ ...s, slack: { ...s.slack, enabled: v } }); save("slack", { enabled: v }) }}
        onSave={() => save("slack", { enabled: true, ...(secret("slack") ? { webhookUrl: secret("slack") } : {}) })}
      >
        <Input type="password" placeholder={s.slack.configured ? SECRET_PLACEHOLDER : "https://hooks.slack.com/services/…"} value={secret("slack")} onChange={e => setSecret("slack", e.target.value)} />
      </Card>

      {/* Discord */}
      <Card
        title="Discord" icon={MessageSquare} target="discord"
        blurb="Post each new ticket to a Discord channel via a Webhook URL."
        enabled={s.discord.enabled} configured={s.discord.configured}
        onToggle={(v) => { setS({ ...s, discord: { ...s.discord, enabled: v } }); save("discord", { enabled: v }) }}
        onSave={() => save("discord", { enabled: true, ...(secret("discord") ? { webhookUrl: secret("discord") } : {}) })}
      >
        <Input type="password" placeholder={s.discord.configured ? SECRET_PLACEHOLDER : "https://discord.com/api/webhooks/…"} value={secret("discord")} onChange={e => setSecret("discord", e.target.value)} />
      </Card>

      {/* Telegram */}
      <Card
        title="Telegram" icon={Send} target="telegram"
        blurb={s.telegram.botConnected
          ? "Send tickets to a team channel using your connected support bot. Add the bot to the channel and paste the channel's chat ID."
          : "Connect a Telegram bot first (Telegram page), then send tickets to a team channel."}
        enabled={s.telegram.enabled}
        configured={s.telegram.botConnected && !!s.telegram.chatId}
        saveDisabled={!s.telegram.botConnected}
        onToggle={(v) => { setS({ ...s, telegram: { ...s.telegram, enabled: v } }); save("telegram", { enabled: v }) }}
        onSave={() => save("telegram", { enabled: true, chatId: s.telegram.chatId })}
      >
        <Input placeholder="Channel chat ID, e.g. -1001234567890" value={s.telegram.chatId} disabled={!s.telegram.botConnected} onChange={e => setS({ ...s, telegram: { ...s.telegram, chatId: e.target.value } })} />
      </Card>

      {/* Linear */}
      <Card
        title="Linear" icon={CheckCircle2} target="linear"
        blurb="Open a Linear issue for each ticket. Needs a personal API key and a team ID."
        enabled={s.linear.enabled} configured={s.linear.configured}
        onToggle={(v) => { setS({ ...s, linear: { ...s.linear, enabled: v } }); save("linear", { enabled: v }) }}
        onSave={() => save("linear", { enabled: true, teamId: s.linear.teamId, ...(secret("linear") ? { apiKey: secret("linear") } : {}) })}
      >
        <Input type="password" placeholder={s.linear.configured ? SECRET_PLACEHOLDER : "Linear API key (lin_api_…)"} value={secret("linear")} onChange={e => setSecret("linear", e.target.value)} />
        <Input placeholder="Team ID" value={s.linear.teamId} onChange={e => setS({ ...s, linear: { ...s.linear, teamId: e.target.value } })} />
      </Card>

      {/* GitHub */}
      <Card
        title="GitHub Issues" icon={CheckCircle2} target="github"
        blurb="Open a GitHub issue for each ticket. Needs a token with repo/issues scope."
        enabled={s.github.enabled} configured={s.github.configured}
        onToggle={(v) => { setS({ ...s, github: { ...s.github, enabled: v } }); save("github", { enabled: v }) }}
        onSave={() => save("github", { enabled: true, repo: s.github.repo, ...(secret("github") ? { token: secret("github") } : {}) })}
      >
        <Input type="password" placeholder={s.github.configured ? SECRET_PLACEHOLDER : "GitHub token (ghp_…)"} value={secret("github")} onChange={e => setSecret("github", e.target.value)} />
        <Input placeholder="Repository (owner/name)" value={s.github.repo} onChange={e => setS({ ...s, github: { ...s.github, repo: e.target.value } })} />
      </Card>

      {/* Jira */}
      <Card
        title="Jira" icon={CheckCircle2} target="jira"
        blurb="Create a Jira issue for each ticket so your team can triage it there."
        enabled={s.jira.enabled} configured={s.jira.configured}
        onToggle={(v) => { setS({ ...s, jira: { ...s.jira, enabled: v } }); save("jira", { enabled: v }) }}
        onSave={() => save("jira", { enabled: true, domain: s.jira.domain, email: s.jira.email, projectKey: s.jira.projectKey, ...(secret("jira") ? { apiToken: secret("jira") } : {}) })}
      >
        <Input placeholder="Site domain (your-team.atlassian.net)" value={s.jira.domain} onChange={e => setS({ ...s, jira: { ...s.jira, domain: e.target.value } })} />
        <Input placeholder="Account email" value={s.jira.email} onChange={e => setS({ ...s, jira: { ...s.jira, email: e.target.value } })} />
        <Input placeholder="Project key (e.g. SUP)" value={s.jira.projectKey} onChange={e => setS({ ...s, jira: { ...s.jira, projectKey: e.target.value } })} />
        <Input type="password" placeholder={s.jira.configured ? SECRET_PLACEHOLDER : "Jira API token"} value={secret("jira")} onChange={e => setSecret("jira", e.target.value)} />
      </Card>
    </div>
  )
}
