"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EmbedCodeDisplayProps {
  publishableKey: string
  widgetBaseUrl: string
}

export function EmbedCodeDisplay({ publishableKey, widgetBaseUrl }: EmbedCodeDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const widgetSrc = `${widgetBaseUrl}/widget?key=${publishableKey}`

  const SNIPPETS = {
    script: `<!-- Floating widget (bottom-right) -->\n<script>\n  (function(){\n    var f = document.createElement('iframe');\n    f.src = "${widgetSrc}";\n    f.allow = "clipboard-write";\n    f.style.cssText = "position:fixed;bottom:20px;right:20px;width:380px;height:580px;border:none;z-index:2147483647;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4)";\n    document.body.appendChild(f);\n  })();\n</script>`,
    inline: `<!-- Inline embed -->\n<iframe\n  src="${widgetSrc}"\n  style="width:100%;height:580px;border:none;border-radius:16px;"\n  allow="clipboard-write"\n  loading="lazy">\n</iframe>`,
    react: `npm install @txid/react\n\nimport { TxIDWidget } from '@txid/react'\n\nexport default function App() {\n  return (\n    <>\n      <YourApp />\n      <TxIDWidget apiKey="${publishableKey}" />\n    </>\n  )\n}`,
  }

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* API key */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">Your API key</p>
          <p className="font-mono text-sm truncate">{publishableKey}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => copy("key", publishableKey)}>
          {copied === "key" ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>

      {/* Embed code */}
      <Tabs defaultValue="script">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="script">Script tag</TabsTrigger>
          <TabsTrigger value="inline">Inline div</TabsTrigger>
          <TabsTrigger value="react">React / npm</TabsTrigger>
        </TabsList>

        {(["script", "inline"] as const).map(tab => (
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

        <TabsContent value="react">
          <div className="rounded-lg border border-border bg-muted p-6 text-center space-y-2">
            <p className="text-sm font-medium">@txid/react npm package</p>
            <p className="text-xs text-muted-foreground">
              Coming soon — the React package is in development.
              Use the script tag or inline div embed in the meantime.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
