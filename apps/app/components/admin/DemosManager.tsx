"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Copy, ExternalLink, Loader2 } from "lucide-react"
import { SELECTABLE_CHAINS } from "@/lib/types/config"
import type { ChainId } from "@/lib/types/config"
import {
  createDemo, renameDemo, deleteDemo, updateDemoConfig, addDemoContract,
  type DemoSummary,
} from "@/lib/actions/demos"

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://txid.support"

function buildBookmarklet(origin: string, key: string): string {
  return (
    "javascript:(function(){if(document.getElementById('txid-widget-root'))return;" +
    "var s=document.createElement('script');s.id='txid-widget-script';" +
    `s.src='${origin}/widget.js';s.setAttribute('data-key','${key}');` +
    "document.body.appendChild(s);})();void%200"
  )
}

// React strips javascript: hrefs from JSX, so set it imperatively — the anchor
// stays fully draggable to the bookmarks bar.
function BookmarkletLink({ href, label }: { href: string; label: string }) {
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => { if (ref.current) ref.current.setAttribute("href", href) }, [href])
  return (
    <a
      ref={ref}
      onClick={e => e.preventDefault()}
      draggable
      className="inline-flex cursor-grab items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground active:cursor-grabbing"
      title="Drag me to your bookmarks bar"
    >
      🔖 {label}
    </a>
  )
}

const DEMO_CONTRACT_CHAINS = SELECTABLE_CHAINS.filter(c => c.id !== "solana")

export function DemosManager({ initial }: { initial: DemoSummary[] }) {
  const [demos, setDemos] = useState<DemoSummary[]>(initial)
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null)
  const [pending, start] = useTransition()
  const [origin, setOrigin] = useState("https://app.txid.support")
  useEffect(() => { setOrigin(window.location.origin) }, [])

  const selected = demos.find(d => d.id === selectedId) ?? null

  function patchLocal(id: string, patch: Partial<DemoSummary>) {
    setDemos(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)))
  }

  function newDemo() {
    start(async () => {
      try {
        const d = await createDemo(`Demo ${demos.length + 1}`)
        setDemos(prev => [...prev, d])
        setSelectedId(d.id)
      } catch { toast.error("Couldn't create demo") }
    })
  }

  function saveBranding(id: string, patch: Partial<DemoSummary["branding"]>) {
    const d = demos.find(x => x.id === id)
    if (!d) return
    const branding = { ...d.branding, ...patch }
    patchLocal(id, { branding })
    start(async () => { try { await updateDemoConfig(id, { branding }) } catch { toast.error("Save failed") } })
  }

  const copy = (text: string, label: string) => { void navigator.clipboard.writeText(text); toast.success(`${label} copied`) }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      {/* Left: demo list */}
      <div className="space-y-2">
        <button onClick={newDemo} disabled={pending} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors">
          <Plus className="size-4" /> New demo
        </button>
        {demos.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${d.id === selectedId ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
          >
            <span className="size-3 shrink-0 rounded-full" style={{ background: d.branding.primaryColor }} />
            <span className="truncate">{d.name}</span>
          </button>
        ))}
        {demos.length === 0 && <p className="px-1 text-xs text-muted-foreground">No demos yet. Create one to start.</p>}
      </div>

      {/* Right: editor */}
      {!selected ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Select or create a demo.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Name */}
          <div className="flex items-center gap-2">
            <input
              defaultValue={selected.name}
              onBlur={e => { const v = e.target.value; patchLocal(selected.id, { name: v }); start(async () => { await renameDemo(selected.id, v) }) }}
              className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-lg font-semibold outline-none focus:border-ring"
            />
            <button
              onClick={() => { if (confirm(`Delete demo "${selected.name}"?`)) start(async () => { await deleteDemo(selected.id); setDemos(prev => prev.filter(d => d.id !== selected.id)); setSelectedId(null) }) }}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:text-red-500 hover:border-red-500/40"
              title="Delete demo"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          {/* Launch artifacts */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Launch this demo</p>
            <div className="flex flex-wrap items-center gap-3">
              <BookmarkletLink href={buildBookmarklet(origin, selected.key)} label={selected.name} />
              <span className="text-xs text-muted-foreground">← drag to your bookmarks bar, then click it on any site to inject this widget.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Share link:</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs">{`${WEB_URL}/d/${selected.key}`}</code>
              <button onClick={() => copy(`${WEB_URL}/d/${selected.key}`, "Share link")} className="text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button>
              <a href={`${origin}/widget?key=${selected.key}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Preview <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          {/* Branding */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Branding</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([["primaryColor", "Primary"], ["secondaryColor", "Bubble"], ["backgroundColor", "Background"], ["textColor", "Text"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <input type="color" value={selected.branding[key] as string} onChange={e => saveBranding(selected.id, { [key]: e.target.value })} className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent" />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input placeholder="Agent name (e.g. Team Finance Support)" defaultValue={selected.branding.agentName ?? ""} onBlur={e => saveBranding(selected.id, { agentName: e.target.value || null })} className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
              <input placeholder="Logo URL (optional)" defaultValue={selected.branding.logoUrl ?? ""} onBlur={e => saveBranding(selected.id, { logoUrl: e.target.value || null })} className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
            </div>
            <input placeholder="Welcome message (optional)" defaultValue={selected.branding.welcomeMessage ?? ""} onBlur={e => saveBranding(selected.id, { welcomeMessage: e.target.value || null })} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
          </div>

          {/* Contracts */}
          <DemoContracts demo={selected} onChange={c => patchLocal(selected.id, { contractCount: c })} />
        </div>
      )}
    </div>
  )
}

function DemoContracts({ demo, onChange }: { demo: DemoSummary; onChange: (count: number) => void }) {
  const [addr, setAddr] = useState("")
  const [name, setName] = useState("")
  const [chain, setChain] = useState<ChainId>(demo.chains[0] ?? "0x1")
  const [count, setCount] = useState(demo.contractCount)
  const [pending, start] = useTransition()

  function add() {
    start(async () => {
      const res = await addDemoContract(demo.id, addr, chain, name)
      if (res.ok) { setAddr(""); setName(""); const c = count + 1; setCount(c); onChange(c); toast.success("Contract added (ABI fetched if verified)") }
      else toast.error(res.error ?? "Couldn't add contract")
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Watched contracts</p>
        <p className="text-xs text-muted-foreground mt-0.5">The prospect&apos;s real contracts, so the bot diagnoses their actual on-chain activity. {count} added.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="0x… contract address" value={addr} onChange={e => setAddr(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
        <select value={chain} onChange={e => setChain(e.target.value as ChainId)} className="rounded-lg border border-input bg-transparent px-2 py-2 text-sm">
          {DEMO_CONTRACT_CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Label (optional)" value={name} onChange={e => setName(e.target.value)} className="w-32 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
        <button onClick={add} disabled={pending || !addr} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
        </button>
      </div>
    </div>
  )
}
