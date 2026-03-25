"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { clsx } from "clsx";
import { FadeIn } from "@/components/ui/FadeIn";

const TABS = ["Script Tag", "Inline Div", "React / npm"] as const;
type Tab = (typeof TABS)[number];

const CODE: Record<Tab, { language: string; code: string }> = {
  "Script Tag": {
    language: "html",
    code: `<!-- Add before </body> — that's it -->
<script
  src="https://txid.support/widget.js"
  data-key="YOUR_API_KEY">
</script>`,
  },
  "Inline Div": {
    language: "html",
    code: `<!-- Place where you want the widget -->
<div
  id="txid-support"
  data-key="YOUR_API_KEY">
</div>
<script src="https://txid.support/widget.js"></script>`,
  },
  "React / npm": {
    language: "tsx",
    code: `// Install
npm install @txid/support

// Use in your app
import { TxIDSupport } from '@txid/support'

export default function App() {
  return (
    <>
      <YourApp />
      <TxIDSupport apiKey="YOUR_API_KEY" />
    </>
  )
}`,
  },
};

function tokenize(code: string, language: string): React.ReactNode {
  if (language === "html") {
    return code.split(/(<[^>]+>|"[^"]*"|<!--[^>]*-->)/g).map((part, i) => {
      if (part.startsWith("<!--")) return <span key={i} className="text-[#71717a]">{part}</span>;
      if (part.startsWith("<") && part.endsWith(">")) return <span key={i} className="text-[#6366f1]">{part}</span>;
      if (part.startsWith('"')) return <span key={i} className="text-[#22c55e]">{part}</span>;
      return <span key={i} className="text-[#e4e4e7]">{part}</span>;
    });
  }
  return code.split(/(import|from|export|default|return|const|function|'[^']*'|"[^"]*"|\/\/[^\n]*)/g).map((part, i) => {
    if (["import", "from", "export", "default", "return", "const", "function"].includes(part))
      return <span key={i} className="text-[#6366f1]">{part}</span>;
    if (part.startsWith("//")) return <span key={i} className="text-[#71717a]">{part}</span>;
    if (part.startsWith("'") || part.startsWith('"'))
      return <span key={i} className="text-[#22c55e]">{part}</span>;
    return <span key={i} className="text-[#e4e4e7]">{part}</span>;
  });
}

export function EmbedPreview() {
  const [activeTab, setActiveTab] = useState<Tab>("Script Tag");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(CODE[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="font-mono text-sm text-accent mb-3">{`// Integration`}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Embed in 30 seconds
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Three ways to integrate — pick whatever fits your stack.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="max-w-2xl mx-auto">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="flex border-b border-[var(--border)]">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      "flex-1 py-3 text-xs font-medium transition-colors",
                      activeTab === tab
                        ? "text-accent border-b-2 border-accent bg-accent-muted"
                        : "text-muted hover:text-white"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative">
                <pre className="p-6 text-xs leading-relaxed overflow-x-auto font-mono">
                  <code>{tokenize(CODE[activeTab].code, CODE[activeTab].language)}</code>
                </pre>
                <button
                  onClick={copy}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-muted hover:text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
