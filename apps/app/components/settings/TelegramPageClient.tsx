"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  CheckCircle2, Send, Trash2, ExternalLink, Copy,
  Globe, FileCode2, Zap, Image, ChevronRight, AlertTriangle, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveTelegramToken, removeTelegramToken, resyncTelegramWebhook, type TelegramHealth } from "@/lib/actions/telegram"
import { telegramBotName, telegramBotUsernameSuggestion, TELEGRAM_TOKEN_RE } from "@/lib/telegram-name"
import { cn } from "@/lib/utils"

interface Props {
  projectId: string
  projectName: string
  botUsername: string | null
  connected: boolean
  languageLabel: string
  contractCount: number
  initialHealth?: TelegramHealth | null
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-sm text-foreground hover:bg-muted/80 transition-colors select-all cursor-copy"
    >
      {label}
      <Copy className={cn("size-3 shrink-0 transition-colors", copied ? "text-emerald-500" : "text-muted-foreground")} />
    </button>
  )
}

export function TelegramPageClient({
  projectId,
  projectName,
  botUsername,
  connected,
  languageLabel,
  contractCount,
  initialHealth = null,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [token, setToken] = useState("")
  const [isConnected, setIsConnected] = useState(connected)
  const [username, setUsername] = useState(botUsername)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [health, setHealth] = useState<TelegramHealth | null>(initialHealth)
  const [resyncing, setResyncing] = useState(false)

  function handleResync() {
    setResyncing(true)
    resyncTelegramWebhook(projectId)
      .then(next => {
        setHealth(next)
        toast.success(next.status === "ok" ? "Webhook re-synced. It's healthy." : "Webhook re-synced.")
      })
      .catch(err => toast.error(err instanceof Error ? err.message : "Re-sync failed"))
      .finally(() => setResyncing(false))
  }

  const suggestedName = telegramBotName(projectName)
  const suggestedUsername = telegramBotUsernameSuggestion(projectName)
  const tokenValid = TELEGRAM_TOKEN_RE.test(token.trim())

  function handleSave() {
    if (!token.trim()) return
    startTransition(async () => {
      try {
        const result = await saveTelegramToken(projectId, token.trim())
        setIsConnected(true)
        setUsername(result.username)
        setDisplayName(result.botDisplayName)
        setToken("")
        toast.success(`@${result.username} is live`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to connect bot")
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeTelegramToken(projectId)
        setIsConnected(false)
        setUsername(null)
        setDisplayName(null)
        toast.success("Telegram bot disconnected")
      } catch {
        toast.error("Failed to disconnect bot")
      }
    })
  }

  if (isConnected && username) {
    const botName = displayName ?? telegramBotName(projectName)
    return (
      <div className="space-y-4 max-w-2xl">

        {/* Status header */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#229ED9]/15">
                <Send className="size-5 text-[#229ED9]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-semibold text-sm">Bot live</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground">{botName}</span>
                  {" · "}
                  <a
                    href={`https://t.me/${username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:text-primary/80 transition-colors"
                  >
                    @{username}
                    <ExternalLink className="size-3 ml-0.5" />
                  </a>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive gap-1.5 shrink-0"
              onClick={handleRemove}
              disabled={isPending}
            >
              <Trash2 className="size-3.5" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Webhook health — surfaces a silently-failing webhook that would
            otherwise present as a dead bot with no explanation. */}
        {health && health.status !== "ok" && (
          <div className={cn(
            "rounded-lg border p-4 flex items-start gap-3",
            health.status === "error" || health.status === "mismatch"
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-border bg-muted/30",
          )}>
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-400" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-200">
                {health.status === "error" && "Telegram is reporting a delivery error"}
                {health.status === "mismatch" && "Webhook points somewhere unexpected"}
                {health.status === "no_token" && "Webhook not wired"}
              </p>
              <p className="text-xs text-muted-foreground">
                {health.status === "error" && health.lastErrorMessage
                  ? `Last error: “${health.lastErrorMessage}”. `
                  : ""}
                {health.status === "mismatch"
                  ? `It's set to ${health.currentUrl ?? "nothing"}, but should be ${health.expectedUrl}. `
                  : ""}
                {health.pendingUpdateCount > 0 ? `${health.pendingUpdateCount} update(s) are stuck in the queue. ` : ""}
                Re-sync to re-point it at this project and clear the error.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleResync}
                disabled={resyncing}
              >
                <RefreshCw className={cn("size-3.5", resyncing && "animate-spin")} />
                {resyncing ? "Re-syncing…" : "Re-sync webhook"}
              </Button>
            </div>
          </div>
        )}

        {health && health.status === "ok" && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Webhook healthy — Telegram is delivering updates to this project.
            </p>
          </div>
        )}

        {/* Auto-configured */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Auto-configured</p>
          <ul className="space-y-2.5">
            <ConfigRow icon={CheckCircle2} iconClass="text-emerald-500" label="Bot name" value={botName} />
            <ConfigRow icon={CheckCircle2} iconClass="text-emerald-500" label="Commands" value="/ask · /help · /start" />
            <ConfigRow icon={Globe} iconClass="text-blue-500" label="Language" value={languageLabel} />
            <ConfigRow
              icon={FileCode2}
              iconClass={contractCount > 0 ? "text-emerald-500" : "text-amber-500"}
              label="Smart contracts"
              value={contractCount > 0 ? `${contractCount} contract${contractCount === 1 ? "" : "s"} loaded` : "None yet: add contracts to unlock transaction support"}
            />
            <ConfigRow icon={Zap} iconClass="text-emerald-500" label="Webhook" value="Active" />
          </ul>
        </div>

        {/* Profile picture — the one manual step */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Image className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Profile picture</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Optional</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Download our branded avatar and set it as your bot&apos;s profile picture via @BotFather.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/brand/txid-icon-512.png"
              download="txid-bot-avatar.png"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              Download avatar
            </a>
            <p className="text-xs text-muted-foreground">
              Then in Telegram: message <span className="font-mono text-foreground">@BotFather</span>, send{" "}
              <CopyButton text="/setuserpic" label="/setuserpic" />, select your bot, upload the image.
            </p>
          </div>
        </div>

        {/* Add to group */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-medium">Add to your group</p>
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`https://t.me/${username}?startgroup=true`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#229ED9] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#229ED9]/90 transition-colors"
            >
              <Send className="size-3.5" />
              Add @{username} to a group
              <ExternalLink className="size-3" />
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(`https://t.me/${username}`)
                toast.success("Link copied")
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Copy className="size-3.5" />
              Copy bot link
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Make the bot an <span className="font-medium text-foreground">admin</span> so it can read messages and respond. Users trigger it by sending <span className="font-mono">@{username}</span> or <span className="font-mono">/ask</span>.
          </p>
        </div>

        {/* Capability note */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">What Telegram can and cannot do</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-500">✓</span>Full docs, contracts, and language support: same knowledge base as the web widget</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-500">✓</span>Conversation history per user per group</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-amber-500">~</span>Escalation prompts are included, but users must follow up via your support channel manually. Telegram cannot open in-widget tickets</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 text-amber-500">~</span>Wallet tools are not available: Telegram users cannot connect a wallet for on-chain lookups</li>
          </ul>
        </div>

      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Step 1 */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span>
          <p className="font-medium text-sm">Create a bot with @BotFather</p>
        </div>

        <div className="ml-9 space-y-3">
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#229ED9] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#229ED9]/90 transition-colors"
            >
              Open @BotFather
              <ExternalLink className="size-3" />
            </a>
            <span className="text-xs text-muted-foreground">then send</span>
            <CopyButton text="/newbot" label="/newbot" />
          </div>

          <div className="rounded-md bg-muted/50 border border-border px-3 py-2.5 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">BotFather asks two questions. Copy and paste these answers:</p>
            <div className="space-y-1.5 ml-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ChevronRight className="size-3 shrink-0" />
                <span className="w-36 shrink-0">1. &quot;Choose a name&quot;</span>
                <CopyButton text={suggestedName} label={suggestedName} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ChevronRight className="size-3 shrink-0" />
                <span className="w-36 shrink-0">2. &quot;Choose a username&quot;</span>
                <CopyButton text={suggestedUsername} label={suggestedUsername} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 ml-2">
              If the username is taken, add a word or number until BotFather accepts it. Any name works, these are just suggestions.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            BotFather then replies with a token that looks like{" "}
            <span className="font-mono text-foreground bg-muted rounded px-1 py-0.5">7654321098:AAEhBG...</span>
            {" "}Copy the whole thing.
          </p>
        </div>
      </div>

      {/* Step 2 */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span>
          <p className="font-medium text-sm">Paste your token. We handle the rest</p>
        </div>

        <div className="ml-9 space-y-3">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="7654321098:AAEhBG..."
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && tokenValid) handleSave() }}
              className="font-mono text-sm"
            />
            <Button
              onClick={handleSave}
              disabled={isPending || !tokenValid}
              className="shrink-0"
            >
              {isPending ? "Connecting..." : "Connect"}
            </Button>
          </div>

          {token.trim().length > 0 && !tokenValid && (
            <p className="text-xs text-amber-400">
              That doesn&apos;t look like a bot token yet. It&apos;s the long code from BotFather with a colon in the middle, like{" "}
              <span className="font-mono">7654321098:AAEhBG...</span> Make sure you copied all of it.
            </p>
          )}

          <div className="rounded-md bg-muted/50 border border-border px-3 py-2.5 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">What happens automatically when you connect:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 ml-2">
              <li><CheckCircle2 className="size-3 inline text-emerald-500 -mt-0.5 mr-1" />Bot name set to &quot;{suggestedName}&quot;</li>
              <li><CheckCircle2 className="size-3 inline text-emerald-500 -mt-0.5 mr-1" />Commands configured (/ask, /help, /start)</li>
              <li><CheckCircle2 className="size-3 inline text-emerald-500 -mt-0.5 mr-1" />Webhook wired to your project</li>
              <li><CheckCircle2 className="size-3 inline text-emerald-500 -mt-0.5 mr-1" />Language set to: {languageLabel}</li>
              {contractCount > 0 && (
                <li><CheckCircle2 className="size-3 inline text-emerald-500 -mt-0.5 mr-1" />{contractCount} smart contract{contractCount === 1 ? "" : "s"} loaded</li>
              )}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Your token is stored securely and never exposed to users.
          </p>
        </div>
      </div>

    </div>
  )
}

function ConfigRow({
  icon: Icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ElementType
  iconClass: string
  label: string
  value: string
}) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <Icon className={cn("size-4 shrink-0 mt-0.5", iconClass)} />
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </li>
  )
}
