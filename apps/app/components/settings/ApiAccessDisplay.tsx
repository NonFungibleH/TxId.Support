"use client"

import { useState } from "react"
import { Copy, Check, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ApiAccessDisplayProps {
  secretKey: string
  apiBaseUrl: string
}

export function ApiAccessDisplay({ secretKey, apiBaseUrl }: ApiAccessDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const masked = secretKey.slice(0, 7) + "•".repeat(Math.max(0, secretKey.length - 11)) + secretKey.slice(-4)

  const curl = `curl -X POST ${apiBaseUrl}/api/v1/diagnose \\
  -H "Authorization: Bearer ${secretKey}" \\
  -H "Content-Type: application/json" \\
  -d '{ "tx": "0x…" }'`

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Secret key */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">Secret key — server-side only, never expose in a browser</p>
          <p className="font-mono text-sm truncate">{revealed ? secretKey : masked}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRevealed((v) => !v)} aria-label={revealed ? "Hide" : "Reveal"}>
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        <Button variant="outline" size="sm" onClick={() => copy("key", secretKey)}>
          {copied === "key" ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>

      {/* Example request */}
      <div className="relative rounded-lg border border-border bg-muted">
        <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed">{curl}</pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2"
          onClick={() => copy("curl", curl)}
        >
          {copied === "curl" ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Send a transaction hash, get back a structured diagnosis: status, cause, decoded error, a plain-English
        explanation, the recommended fix, token transfers and a gas verdict. API calls are rate-limited to 60/min and
        don&apos;t count against your widget&apos;s monthly conversation limit.{" "}
        <a href="/platform" className="underline underline-offset-2 hover:text-foreground">Read the docs →</a>
      </p>
    </div>
  )
}
