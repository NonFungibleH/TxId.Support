"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createProjectWithMode } from "@/lib/actions/project"
import { ENABLE_TOKEN_MODE } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Mode = "support" | "token"

const MODES: { id: Mode; emoji: string; title: string; desc: string }[] = [
  {
    id: "support",
    emoji: "🏛️",
    title: "Protocol",
    desc: "AI-powered user support, transaction diagnostics, docs Q&A",
  },
  {
    id: "token",
    emoji: "🪙",
    title: "Project",
    desc: "Live token price, trading widget, community links",
  },
]

export function OnboardingForm() {
  const [mode, setMode] = useState<Mode | null>(ENABLE_TOKEN_MODE ? null : "support")
  const [name, setName] = useState("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit() {
    if (!mode || !name.trim()) return
    startTransition(async () => {
      await createProjectWithMode(name.trim(), mode)
      router.push("/dashboard")
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">TX</span>
          </div>
          <h1 className="text-2xl font-bold">Create your project</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Give your protocol a name to get started.
          </p>
        </div>

        {/* Mode selection — only shown when token mode is enabled */}
        {ENABLE_TOKEN_MODE && (
          <div className="space-y-3">
            {MODES.map(({ id, emoji, title, desc }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-colors",
                  mode === id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-accent/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <div
                    className={cn(
                      "size-4 rounded-full border-2 transition-colors",
                      mode === id ? "border-primary bg-primary" : "border-muted-foreground"
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <Input
            placeholder="Protocol name (e.g. Uniswap, Aave)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit() }}
          />
          <Button
            className="w-full"
            disabled={!mode || !name.trim() || isPending}
            onClick={submit}
          >
            {isPending ? "Creating…" : "Create project →"}
          </Button>
        </div>
      </div>
    </div>
  )
}
