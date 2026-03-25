"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EmbedCodeDisplayProps {
  publishableKey: string
}

export function EmbedCodeDisplay({ publishableKey }: EmbedCodeDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const SNIPPETS = {
    script: `<script\n  src="https://txid.support/widget.js"\n  data-key="${publishableKey}">\n</script>`,
    inline: `<div\n  id="txid-support"\n  data-key="${publishableKey}">\n</div>\n<script src="https://txid.support/widget.js"></script>`,
    react: `npm install @txid/support\n\nimport { TxIDSupport } from '@txid/support'\n\nexport default function App() {\n  return (\n    <>\n      <YourApp />\n      <TxIDSupport apiKey="${publishableKey}" />\n    </>\n  )\n}`,
  }

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">Your API key</p>
          <p className="font-mono text-sm truncate">{publishableKey}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => copy("key", publishableKey)}>
          {copied === "key" ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>

      <Tabs defaultValue="script">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="script">Script tag</TabsTrigger>
          <TabsTrigger value="inline">Inline div</TabsTrigger>
          <TabsTrigger value="react">React / npm</TabsTrigger>
        </TabsList>

        {(["script", "inline", "react"] as const).map(tab => (
          <TabsContent key={tab} value={tab}>
            <div className="relative rounded-lg border border-border bg-muted">
              <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                {SNIPPETS[tab]}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copy(tab, SNIPPETS[tab])}
              >
                {copied === tab ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
