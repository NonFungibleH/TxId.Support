"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle2, Send, Trash2, ExternalLink, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveTelegramToken, removeTelegramToken } from "@/lib/actions/telegram"

interface Props {
  projectId: string
  botUsername: string | null
  connected: boolean
}

const STEPS = [
  { n: 1, text: "Open Telegram and search for @BotFather" },
  { n: 2, text: 'Send /newbot and follow the prompts to name your bot' },
  { n: 3, text: "Copy the token BotFather gives you and paste it below" },
  { n: 4, text: "Add the bot to your Telegram group and make it an admin" },
]

export function TelegramPageClient({ projectId, botUsername, connected }: Props) {
  const [isPending, startTransition] = useTransition()
  const [token, setToken] = useState("")
  const [isConnected, setIsConnected] = useState(connected)
  const [username, setUsername] = useState(botUsername)

  function handleSave() {
    if (!token.trim()) return
    startTransition(async () => {
      try {
        const result = await saveTelegramToken(projectId, token.trim())
        setIsConnected(true)
        setUsername(result.username)
        setToken("")
        toast.success(`@${result.username} connected`)
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
        toast.success("Telegram bot disconnected")
      } catch {
        toast.error("Failed to disconnect bot")
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {isConnected && username ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-[#229ED9]/15">
                <Send className="size-4 text-[#229ED9]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="font-medium text-sm">Bot connected</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">@{username}</p>
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

          <div className="rounded-md bg-muted/50 border border-border px-4 py-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next steps</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Add <span className="font-medium text-foreground">@{username}</span> to your Telegram group as an admin</li>
              <li>Users can @mention the bot or use /ask to start a conversation</li>
              <li>The bot has full access to your docs, contracts, and protocol context</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Bot link:</span>
            <a
              href={`https://t.me/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
            >
              t.me/{username}
              <ExternalLink className="size-3" />
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(`https://t.me/${username}`)
                toast.success("Copied")
              }}
              className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="size-3" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-[#229ED9]/15">
                <Send className="size-4 text-[#229ED9]" />
              </div>
              <div>
                <p className="font-medium text-sm">Connect a Telegram bot</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your AI will respond to @mentions and /ask commands in any group it is added to</p>
              </div>
            </div>

            <ol className="space-y-2">
              {STEPS.map(({ n, text }) => (
                <li key={n} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground mt-0.5">
                    {n}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <p className="text-sm font-medium">Bot token</p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="1234567890:AABBccDD..."
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave() }}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleSave}
                disabled={isPending || !token.trim()}
                className="shrink-0"
              >
                {isPending ? "Connecting..." : "Connect"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The token is stored securely and used only to send messages on your behalf.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
