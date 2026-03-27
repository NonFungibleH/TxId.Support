# Phase 2: Mode System + Token Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `mode` column to projects, build a dedicated onboarding wizard for mode selection, create the Token Mode widget (Trade/Community/Ask tabs with live DexScreener data), make the dashboard sidebar mode-aware, add two new Token Mode config pages, update the AI prompt for Token Mode, and update the marketing site.

**Architecture:** Mode is stored as a `projects.mode` column (default `'support'`). The widget config API returns `mode` so `WidgetApp.tsx` branches at runtime between the existing Support Mode tabs and new Token Mode tabs. The dashboard layout passes `mode` to the sidebar which renders different nav items. The AI chat API skips RAG and tx-diagnostics for token mode, injecting plain-text FAQ instead.

**Tech Stack:** Next.js 14 App Router, Supabase (service role), Clerk v5, Anthropic SDK, DexScreener public API (no key), recharts-free SVG sparkline, Turborepo pnpm monorepo.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260327000002_add_mode.sql` | Create | Add `mode` column to projects |
| `apps/app/lib/supabase/types.ts` | Modify | Add `mode` to projects Row/Insert/Update |
| `apps/app/lib/types/config.ts` | Modify | Add `CommunityConfig`, `tokenModeAsk`, `community` |
| `apps/app/lib/actions/project.ts` | Modify | Add `createProjectWithMode`; extend `updateConfig` revalidation |
| `apps/app/app/onboarding/page.tsx` | Create | Mode-selection + project-name wizard |
| `apps/app/app/dashboard/page.tsx` | Modify | Redirect to `/onboarding` when `project === null`; remove `CreateProjectForm` |
| `apps/app/app/dashboard/layout.tsx` | Modify | Pass `mode` prop to `<Sidebar>` |
| `apps/app/components/dashboard/Sidebar.tsx` | Modify | Accept `mode` prop; render mode-specific nav |
| `apps/app/app/dashboard/community/page.tsx` | Create | Community config form (Token Mode only) |
| `apps/app/app/dashboard/ask/page.tsx` | Create | Ask AI FAQ textarea (Token Mode only) |
| `packages/ai/src/types.ts` | Modify | Add `mode` to `StreamChatParams` |
| `packages/ai/src/prompt.ts` | Modify | Branch system prompt for token vs support mode |
| `apps/app/app/api/widget-config/[key]/route.ts` | Modify | Return `mode`, `community`, `tokenModeAsk` |
| `apps/app/app/api/chat/route.ts` | Modify | Skip RAG + wallet lookup for token mode |
| `apps/app/app/widget/WidgetApp.tsx` | Modify | Add Token Mode tab set (Trade/Community/Ask) |
| `apps/web/components/sections/Hero.tsx` | Modify | Updated multi-mode headline + subheading |
| `apps/web/components/sections/ThreeModes.tsx` | Create | Three-mode cards section |
| `apps/web/components/sections/PricingSection.tsx` | Modify | Four-tier pricing |
| `apps/web/components/sections/FeatureGrid.tsx` | Modify | Add mode badges to feature cards |
| `apps/web/app/page.tsx` | Modify | Insert `<ThreeModes />` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260327000002_add_mode.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260327000002_add_mode.sql
ALTER TABLE projects
  ADD COLUMN mode text NOT NULL DEFAULT 'support'
  CONSTRAINT projects_mode_check CHECK (mode IN ('support', 'token'));
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste the SQL into the Supabase project SQL Editor and execute. Verify with:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'mode';
```
Expected: one row, `text`, default `'support'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260327000002_add_mode.sql
git commit -m "feat: add projects.mode column (support|token)"
```

---

## Task 2: TypeScript Types — Supabase

**Files:**
- Modify: `apps/app/lib/supabase/types.ts`

- [ ] **Step 1: Add `mode` to the projects Row, Insert, and Update types**

In `apps/app/lib/supabase/types.ts`, find the `projects` table definition. Add `mode: string` to `Row` and `mode?: string` to `Insert` and `Update`:

```typescript
// In projects.Row — add after updated_at:
mode: string;

// In projects.Insert — add after updated_at:
mode?: string;

// In projects.Update — add after updated_at:
mode?: string;
```

- [ ] **Step 2: Verify the app still type-checks**

```bash
cd /Users/howardpearce/Projects/txid-support/.worktrees/phase-1
pnpm --filter @txid/app tsc --noEmit 2>&1 | head -20
```
Expected: no errors (or only pre-existing ones unrelated to `mode`).

- [ ] **Step 3: Commit**

```bash
git add apps/app/lib/supabase/types.ts
git commit -m "feat: add mode to Supabase projects types"
```

---

## Task 3: Config Types — CommunityConfig + tokenModeAsk

**Files:**
- Modify: `apps/app/lib/types/config.ts`

- [ ] **Step 1: Add `CommunityConfig` interface and extend `ProjectConfig`**

Replace the current `ProjectConfig` definition in `apps/app/lib/types/config.ts`:

```typescript
export interface CommunityConfig {
  discord:      string | null
  twitter:      string | null
  telegram:     string | null
  website:      string | null
  whitepaper:   string | null
  announcement: string | null
}

export interface ProjectConfig {
  branding: BrandingConfig
  token: TokenConfig | null
  chains: ChainId[]
  contentBlocks: ContentBlock[]
  docsUrl: string | null
  allowedDomains: string[]
  watchedContracts: WatchedContract[]
  community: CommunityConfig | null
  tokenModeAsk: string | null
}
```

- [ ] **Step 2: Update `DEFAULT_CONFIG` to include new fields**

```typescript
export const DEFAULT_CONFIG: ProjectConfig = {
  branding: { /* unchanged */ },
  token: null,
  chains: ["0x1", "0x2105", "0x38", "0x89", "0xa4b1", "0xa"],
  contentBlocks: [],
  docsUrl: null,
  allowedDomains: [],
  watchedContracts: [],
  community: null,
  tokenModeAsk: null,
}
```

- [ ] **Step 3: Verify type-check**

```bash
pnpm --filter @txid/app tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/lib/types/config.ts
git commit -m "feat: add CommunityConfig and tokenModeAsk to ProjectConfig"
```

---

## Task 4: Server Action — createProjectWithMode

**Files:**
- Modify: `apps/app/lib/actions/project.ts`

- [ ] **Step 1: Add `createProjectWithMode` after the existing `createProject` function**

```typescript
export async function createProjectWithMode(name: string, mode: "support" | "token") {
  const { orgId, userId } = await auth()
  if (!orgId || !userId) throw new Error("Unauthenticated")

  const supabase = createServiceClient()

  const upsertOrgResult = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgId, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  const org = upsertOrgResult.data as unknown as OrgRow | null
  if (!org) throw new Error("Could not resolve organisation")

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name,
      mode,
      config: DEFAULT_CONFIG as unknown as Json,
    })
    .select()
    .single()

  if (error || !project) throw new Error(`Create project failed: ${error?.message}`)

  revalidatePath("/dashboard")
  return project
}
```

- [ ] **Step 2: Add `/dashboard/community` and `/dashboard/ask` to `updateConfig` revalidation**

In the `updateConfig` function, add two lines after the existing `revalidatePath` calls:

```typescript
  revalidatePath("/dashboard/community")
  revalidatePath("/dashboard/ask")
```

- [ ] **Step 3: Verify type-check**

```bash
pnpm --filter @txid/app tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/lib/actions/project.ts
git commit -m "feat: add createProjectWithMode server action"
```

---

## Task 5: Onboarding Wizard Page

**Files:**
- Create: `apps/app/app/onboarding/page.tsx`

- [ ] **Step 1: Create the onboarding wizard**

```typescript
// apps/app/app/onboarding/page.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createProjectWithMode } from "@/lib/actions/project"
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

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode | null>(null)
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
            Choose the mode that fits your use case.
          </p>
        </div>

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

        <div className="space-y-3">
          <Input
            placeholder="Project name (e.g. My Protocol)"
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
```

- [ ] **Step 2: Build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error|Error)" | head -10
```
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/onboarding/page.tsx
git commit -m "feat: onboarding wizard with mode selection"
```

---

## Task 6: Dashboard Page — Redirect to Onboarding

**Files:**
- Modify: `apps/app/app/dashboard/page.tsx`

- [ ] **Step 1: Replace the `project === null` branch with a redirect, remove `CreateProjectForm`**

Replace the block starting at line 18 (`if (!project) {`) and ending at line 33, and remove the `CreateProjectForm` function (lines 105–125), and remove the `createProject` import.

New `if (!project)` block:

```typescript
import { redirect } from "next/navigation"

// ... inside DashboardPage:
if (!project) {
  redirect("/onboarding")
}
```

Also remove these imports that are no longer needed:
- `import { createProject } from "@/lib/actions/project"`
- `import { Button } from "@/components/ui/button"` (if only used in CreateProjectForm)

- [ ] **Step 2: Build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error)" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/dashboard/page.tsx
git commit -m "feat: redirect to /onboarding when no project exists"
```

---

## Task 7: Dashboard Layout — Pass Mode to Sidebar

**Files:**
- Modify: `apps/app/app/dashboard/layout.tsx`
- Modify: `apps/app/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Update layout to fetch project and pass mode to Sidebar**

Replace `apps/app/app/dashboard/layout.tsx`:

```typescript
import { Sidebar } from "@/components/dashboard/Sidebar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { getProject } from "@/lib/actions/project"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { org, project } = await getProject()
  const typedProject = project as unknown as { mode?: string }
  const mode = typedProject?.mode ?? "support"

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mode={mode} />
      <DashboardHeader orgName={org.name} />
      <main className="ml-60 mt-14 p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Update Sidebar to accept mode prop and render mode-specific nav**

Replace `apps/app/components/dashboard/Sidebar.tsx`:

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Paintbrush, Coins, FileCode2, BookOpen,
  Link2, LayoutList, Code2, BarChart3, Users, Globe, MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SUPPORT_NAV = [
  { href: "/dashboard",           label: "Overview",        icon: LayoutDashboard },
  { href: "/dashboard/branding",  label: "Branding",        icon: Paintbrush },
  { href: "/dashboard/token",     label: "Token",           icon: Coins },
  { href: "/dashboard/contracts", label: "Smart Contracts", icon: FileCode2 },
  { href: "/dashboard/docs",      label: "Docs & KB",       icon: BookOpen },
  { href: "/dashboard/chains",    label: "Chains",          icon: Link2 },
  { href: "/dashboard/content",   label: "Content",         icon: LayoutList },
  { href: "/dashboard/embed",     label: "Embed",           icon: Code2 },
  { href: "/dashboard/analytics", label: "Analytics",       icon: BarChart3 },
  { href: "/dashboard/team",      label: "Team",            icon: Users },
]

const TOKEN_NAV = [
  { href: "/dashboard",             label: "Overview",   icon: LayoutDashboard },
  { href: "/dashboard/branding",    label: "Branding",   icon: Paintbrush },
  { href: "/dashboard/token",       label: "Token",      icon: Coins },
  { href: "/dashboard/community",   label: "Community",  icon: Globe },
  { href: "/dashboard/ask",         label: "Ask AI",     icon: MessageSquare },
  { href: "/dashboard/embed",       label: "Embed",      icon: Code2 },
  { href: "/dashboard/analytics",   label: "Analytics",  icon: BarChart3 },
]

export function Sidebar({ mode = "support" }: { mode?: string }) {
  const pathname = usePathname()
  const NAV_ITEMS = mode === "token" ? TOKEN_NAV : SUPPORT_NAV

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">TX</span>
        </div>
        <span className="font-semibold text-sm">TxID Support</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/dashboard"
            ? pathname === "/dashboard"
            : (pathname ?? "").startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">app.txid.support</p>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error)" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/dashboard/layout.tsx apps/app/components/dashboard/Sidebar.tsx
git commit -m "feat: mode-aware sidebar — Token Mode gets tailored nav"
```

---

## Task 8: New Dashboard Page — /dashboard/community

**Files:**
- Create: `apps/app/app/dashboard/community/page.tsx`

- [ ] **Step 1: Create the community config page**

```typescript
// apps/app/app/dashboard/community/page.tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { getProject } from "@/lib/actions/project"
import { updateConfig } from "@/lib/actions/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CommunityConfig } from "@/lib/types/config"
```

This page is a server component that passes initial values to a client form. Create it as two files:

**`apps/app/app/dashboard/community/page.tsx`** (server component):

```typescript
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { CommunityForm } from "@/components/settings/CommunityForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function CommunityPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="text-muted-foreground mt-1">Social links and announcements shown in the widget.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Community links</CardTitle>
          <CardDescription>Leave blank to hide a link from the widget.</CardDescription>
        </CardHeader>
        <CardContent>
          <CommunityForm projectId={typedProject.id} initial={config.community ?? null} />
        </CardContent>
      </Card>
    </div>
  )
}
```

**`apps/app/components/settings/CommunityForm.tsx`** (client component):

```typescript
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateConfig } from "@/lib/actions/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CommunityConfig } from "@/lib/types/config"

const FIELDS: { key: keyof Omit<CommunityConfig, "announcement">; label: string; placeholder: string }[] = [
  { key: "discord",   label: "Discord",    placeholder: "https://discord.gg/..." },
  { key: "twitter",   label: "Twitter/X",  placeholder: "https://x.com/..." },
  { key: "telegram",  label: "Telegram",   placeholder: "https://t.me/..." },
  { key: "website",   label: "Website",    placeholder: "https://yourprotocol.com" },
  { key: "whitepaper",label: "Whitepaper", placeholder: "https://yourprotocol.com/whitepaper.pdf" },
]

export function CommunityForm({
  projectId,
  initial,
}: {
  projectId: string
  initial: CommunityConfig | null
}) {
  const [values, setValues] = useState<CommunityConfig>({
    discord:      initial?.discord      ?? null,
    twitter:      initial?.twitter      ?? null,
    telegram:     initial?.telegram     ?? null,
    website:      initial?.website      ?? null,
    whitepaper:   initial?.whitepaper   ?? null,
    announcement: initial?.announcement ?? null,
  })
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { community: values })
        toast.success("Community links saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  return (
    <div className="space-y-4">
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} className="grid gap-1.5">
          <Label htmlFor={key}>{label}</Label>
          <Input
            id={key}
            type="url"
            placeholder={placeholder}
            value={values[key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value || null }))}
          />
        </div>
      ))}
      <div className="grid gap-1.5">
        <Label htmlFor="announcement">Announcement <span className="text-muted-foreground">(optional)</span></Label>
        <textarea
          id="announcement"
          rows={3}
          placeholder="e.g. V2 is live — check out the new staking pools!"
          value={values.announcement ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, announcement: e.target.value || null }))}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>
      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error)" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/dashboard/community/page.tsx apps/app/components/settings/CommunityForm.tsx
git commit -m "feat: /dashboard/community page for Token Mode"
```

---

## Task 9: New Dashboard Page — /dashboard/ask

**Files:**
- Create: `apps/app/app/dashboard/ask/page.tsx`
- Create: `apps/app/components/settings/AskForm.tsx`

- [ ] **Step 1: Create server page**

```typescript
// apps/app/app/dashboard/ask/page.tsx
import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { AskForm } from "@/components/settings/AskForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function AskPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ask AI</h1>
        <p className="text-muted-foreground mt-1">Context injected into the AI when users ask questions in the widget.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project FAQ</CardTitle>
          <CardDescription>
            Plain text — no embedding required. This is injected directly into the AI system prompt.
            Max ~2,000 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AskForm projectId={typedProject.id} initial={config.tokenModeAsk ?? ""} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create client form**

```typescript
// apps/app/components/settings/AskForm.tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateConfig } from "@/lib/actions/project"
import { Button } from "@/components/ui/button"

export function AskForm({ projectId, initial }: { projectId: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { tokenModeAsk: text.trim() || null })
        toast.success("FAQ saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  return (
    <div className="space-y-3">
      <textarea
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Q: Where can I buy the token?\nA: Buy on Uniswap at https://...\n\nQ: What is the total supply?\nA: 100,000,000 tokens"}
        maxLength={2000}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ring"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{text.length} / 2,000</span>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error)" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/dashboard/ask/page.tsx apps/app/components/settings/AskForm.tsx
git commit -m "feat: /dashboard/ask page for Token Mode AI context"
```

---

## Task 10: AI Package — Mode-Aware System Prompt

**Files:**
- Modify: `packages/ai/src/types.ts`
- Modify: `packages/ai/src/prompt.ts`

- [ ] **Step 1: Add `mode` and `tokenModeAsk` to `StreamChatParams`**

In `packages/ai/src/types.ts`, extend `StreamChatParams`:

```typescript
export interface StreamChatParams {
  projectName: string
  config: ProjectConfigSnapshot
  messages: ChatMessage[]
  walletAddress?: string
  chainId?: string
  ragContext?: string
  mode?: "support" | "token"
  tokenModeAsk?: string | null
}
```

- [ ] **Step 2: Update `buildSystemPrompt` to branch on mode**

Replace `packages/ai/src/prompt.ts`:

```typescript
import type { StreamChatParams } from "./types"

export function buildSystemPrompt(params: StreamChatParams): string {
  const { projectName, config, walletAddress, chainId, ragContext, mode, tokenModeAsk } = params
  const parts: string[] = []

  if (mode === "token") {
    // Token Mode: lightweight prompt, no RAG, no tx diagnostics
    parts.push(
      `You are a helpful assistant for ${projectName}. ` +
        `Answer questions about this project's token, community, and links. ` +
        `Be concise and friendly. If you don't know something, say so.`
    )

    if (config.token) {
      const t = config.token
      const lines = [`## Token`]
      if (t.symbol) lines.push(`Symbol: ${t.symbol}`)
      if (t.name)   lines.push(`Name: ${t.name}`)
      lines.push(`Address: \`${t.address}\``)
      if (t.dexUrl) lines.push(`Trade: ${t.dexUrl}`)
      parts.push(lines.join("\n"))
    }

    if (tokenModeAsk && tokenModeAsk.trim().length > 0) {
      parts.push(`## Project FAQ\n${tokenModeAsk.trim()}`)
    }

    parts.push(
      `## Instructions\n` +
        `- Keep responses under 150 words\n` +
        `- Direct buy/trade questions to the DEX link above\n` +
        `- Never fabricate contract addresses or prices`
    )
  } else {
    // Support Mode: full prompt with RAG, contracts, wallet context
    parts.push(
      `You are a support assistant for ${projectName}, a DeFi protocol. ` +
        `Be helpful, accurate, and concise. If you don't know something, say so clearly — never fabricate on-chain data.`
    )

    if (config.token) {
      const t = config.token
      const lines = [`## Token`, `Symbol: ${t.symbol ?? "unknown"}`, `Address: \`${t.address}\``]
      if (t.name)   lines.push(`Name: ${t.name}`)
      if (t.dexUrl) lines.push(`DEX: ${t.dexUrl}`)
      parts.push(lines.join("\n"))
    }

    if (config.watchedContracts && config.watchedContracts.length > 0) {
      const lines = ["## Smart Contracts"]
      for (const c of config.watchedContracts) {
        lines.push(`- **${c.name}** (\`${c.address}\` on chain ${c.chain}): ${c.description}`)
      }
      parts.push(lines.join("\n"))
    }

    if (walletAddress) {
      const lines = [`## User's Connected Wallet`, `Address: \`${walletAddress}\``]
      if (chainId) lines.push(`Chain ID: ${chainId}`)
      parts.push(lines.join("\n"))
    }

    if (ragContext && ragContext.trim().length > 0) {
      parts.push(`## Documentation\n${ragContext}`)
    }

    parts.push(
      `## Instructions\n` +
        `- Keep responses concise (under 200 words) unless detailed technical explanation is needed\n` +
        `- Format addresses and hashes in \`code\` blocks\n` +
        `- Never invent contract data or transaction details — only reference what is provided above\n` +
        `- If asked about token price, direct users to the DEX link or a block explorer\n` +
        `- When a wallet is connected and the question is about that wallet, answer specifically for that address`
    )
  }

  return parts.join("\n\n")
}
```

- [ ] **Step 3: Verify @txid/ai type-checks**

```bash
pnpm --filter @txid/ai tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/types.ts packages/ai/src/prompt.ts
git commit -m "feat: mode-aware system prompt — token mode skips RAG and tx-diagnostics"
```

---

## Task 11: Widget Config API — Return mode + community + tokenModeAsk

**Files:**
- Modify: `apps/app/app/api/widget-config/[key]/route.ts`

- [ ] **Step 1: Update the GET handler to return new fields**

In the `GET` function, change the select query to include `mode`:

```typescript
const { data: project, error } = await supabase
  .from("projects")
  .select("id, name, config, is_active, mode")
  .eq("publishable_key", key)
  .single()
```

Then in `publicConfig`, add:

```typescript
const publicConfig = {
  projectId: typedProject.id,
  projectName: typedProject.name,
  mode: (typedProject as any).mode ?? "support",
  branding: config.branding,
  chains: config.chains,
  token: config.token
    ? {
        symbol: config.token.symbol,
        chain: config.token.chain,
        dexUrl: config.token.dexUrl,
        address: config.token.address,  // needed for DexScreener lookup
      }
    : null,
  community: config.community ?? null,
  tokenModeAsk: config.tokenModeAsk ?? null,
  watchedContracts: (config.watchedContracts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    chain: c.chain,
    description: c.description,
    address: c.address,
  })),
}
```

- [ ] **Step 2: Build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error)" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/api/widget-config/[key]/route.ts
git commit -m "feat: widget-config API returns mode, community, tokenModeAsk"
```

---

## Task 12: Chat API — Skip RAG for Token Mode

**Files:**
- Modify: `apps/app/app/api/chat/route.ts`

- [ ] **Step 1: Fetch `mode` from project row and skip RAG for token mode**

Change the select query to include `mode`:

```typescript
const { data: project, error: projectError } = await supabase
  .from("projects")
  .select("id, name, config, is_active, mode")
  .eq("publishable_key", key)
  .single()
```

Then replace the RAG block and buildSystemPrompt call:

```typescript
const projectMode = (typedProject as any).mode ?? "support"

// RAG: only run for support mode
let ragContext = ""
if (projectMode === "support") {
  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")
  if (latestUserMessage) {
    const ragResult = await retrieveContext(supabase, typedProject.id, latestUserMessage.content)
    ragContext = ragResult.context
  }
}

// Build system prompt — mode-aware
const systemPrompt = buildSystemPrompt({
  projectName: typedProject.name,
  config: configSnapshot,
  messages,
  walletAddress: projectMode === "support" ? walletAddress : undefined,
  chainId: projectMode === "support" ? chainId : undefined,
  ragContext,
  mode: projectMode,
  tokenModeAsk: config.tokenModeAsk ?? undefined,
})
```

- [ ] **Step 2: Build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error)" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/api/chat/route.ts
git commit -m "feat: skip RAG and wallet lookup for token mode in chat API"
```

---

## Task 13: Token Mode Widget

**Files:**
- Modify: `apps/app/app/widget/WidgetApp.tsx`

This is the most complex task. The widget needs to detect `mode` and render different tabs.

- [ ] **Step 1: Add Token Mode types and DexScreener fetch to WidgetApp.tsx**

Read the current `WidgetApp.tsx` first, then add the following before the `WidgetApp` component:

```typescript
// ─── Token Mode types ─────────────────────────────────────────────────────────

interface DexPair {
  chainId: string
  priceUsd: string | null
  priceChange: { m5: number; h1: number; h6: number; h24: number } | null
  volume: { h24: number } | null
  liquidity: { usd: number } | null
  marketCap: number | null
  fdv: number | null
  baseToken: { address: string; symbol: string; name: string }
}

interface DexScreenerResponse {
  pairs: DexPair[] | null
}

// Map widget chain IDs (hex) to DexScreener chain slugs
const CHAIN_SLUG: Record<string, string> = {
  "0x1":    "ethereum",
  "0x2105": "base",
  "0x38":   "bsc",
  "0x89":   "polygon",
  "0xa4b1": "arbitrum",
  "0xa":    "optimism",
}

function formatUsd(n: number | null | undefined): string {
  if (n == null) return "—"
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(4)}`
}

function PriceSparkline({ priceChange }: { priceChange: DexPair["priceChange"] }) {
  if (!priceChange) return null
  // Synthesise 4-point series from percentage changes (m5, h1, h6, h24)
  // Treat h24 price as base=100, work forward
  const base = 100
  const p24 = base
  const p6  = p24  * (1 + (priceChange.h6  - priceChange.h24) / 100)
  const p1  = p6   * (1 + (priceChange.h1  - priceChange.h6)  / 100)
  const p5m = p1   * (1 + priceChange.m5                       / 100)
  const points = [p24, p6, p1, p5m]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 80, H = 28
  const coords = points
    .map((v, i) => `${(i / (points.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(" ")
  const isUp = p5m >= p24
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline
        points={coords}
        fill="none"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
```

- [ ] **Step 2: Add Token Mode tab components inside WidgetApp**

Inside the `WidgetApp` component, add state for DexScreener data and the three Token Mode tab renderers.

Add state near the top of `WidgetApp`:

```typescript
const [dexData, setDexData] = useState<DexPair | null>(null)
const [dexLoading, setDexLoading] = useState(false)
```

Add a `useEffect` for DexScreener polling (after existing useEffects):

```typescript
useEffect(() => {
  if (config?.mode !== "token" || !config.token?.address) return

  async function fetchDex() {
    setDexLoading(true)
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${config!.token!.address}`
      )
      const data: DexScreenerResponse = await res.json()
      const targetChain = CHAIN_SLUG[config!.token!.chain ?? ""] ?? ""
      const pair = data.pairs?.find((p) => p.chainId === targetChain) ?? data.pairs?.[0] ?? null
      setDexData(pair)
    } catch {
      // silently fail — fallback state shown
    } finally {
      setDexLoading(false)
    }
  }

  fetchDex()
  const interval = setInterval(fetchDex, 30_000)
  return () => clearInterval(interval)
}, [config?.mode, config?.token?.address, config?.token?.chain])
```

- [ ] **Step 3: Add Token Mode tab content renderers**

Add these helper components/functions inside the file (before the main return):

```typescript
// ─── Token Mode tab renderers ──────────────────────────────────────────────────

function TradeTab({
  dexData,
  dexLoading,
  token,
  primaryColor,
}: {
  dexData: DexPair | null
  dexLoading: boolean
  token: NonNullable<WidgetConfig["token"]>
  primaryColor: string
}) {
  const price = dexData?.priceUsd ? parseFloat(dexData.priceUsd) : null
  const change24h = dexData?.priceChange?.h24 ?? null
  const isUp = (change24h ?? 0) >= 0

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {dexLoading && !dexData ? (
        <div style={{ textAlign: "center", color: "var(--txid-muted)", fontSize: "13px", padding: "32px 0" }}>
          Loading price data…
        </div>
      ) : dexData ? (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--txid-text)" }}>
                {price != null ? `$${price < 0.01 ? price.toExponential(4) : price.toFixed(4)}` : "—"}
              </div>
              {change24h != null && (
                <div style={{ fontSize: "13px", color: isUp ? "#22c55e" : "#ef4444", marginTop: "2px" }}>
                  {isUp ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% (24h)
                </div>
              )}
            </div>
            <PriceSparkline priceChange={dexData.priceChange} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {[
              { label: "Market Cap", value: formatUsd(dexData.marketCap) },
              { label: "Volume 24h", value: formatUsd(dexData.volume?.h24) },
              { label: "Liquidity",  value: formatUsd(dexData.liquidity?.usd) },
              { label: "FDV",        value: formatUsd(dexData.fdv) },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: "8px",
                padding: "10px",
              }}>
                <div style={{ fontSize: "10px", color: "var(--txid-muted)", marginBottom: "2px" }}>{label}</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--txid-text)" }}>{value}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", color: "var(--txid-muted)", fontSize: "13px", padding: "32px 0" }}>
          Price data unavailable — check DexScreener
        </div>
      )}

      {token.dexUrl && (
        <a
          href={token.dexUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            background: primaryColor,
            color: "#fff",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          Buy {token.symbol ?? "TOKEN"} →
        </a>
      )}
    </div>
  )
}

function CommunityTab({ community }: { community: WidgetConfig["community"] }) {
  if (!community) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--txid-muted)", fontSize: "13px" }}>
        No community links configured.
      </div>
    )
  }

  const links = [
    { key: "discord",    label: "Discord",    icon: "💬", url: community.discord },
    { key: "twitter",    label: "Twitter/X",  icon: "𝕏",  url: community.twitter },
    { key: "telegram",   label: "Telegram",   icon: "✈️",  url: community.telegram },
    { key: "website",    label: "Website",    icon: "🌐", url: community.website },
    { key: "whitepaper", label: "Whitepaper", icon: "📄", url: community.whitepaper },
  ].filter((l) => l.url)

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {links.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {links.map(({ key, label, icon, url }) => (
            <a
              key={key}
              href={url!}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--txid-text)",
                textDecoration: "none",
              }}
            >
              <span>{icon}</span> {label}
            </a>
          ))}
        </div>
      )}
      {community.announcement && (
        <div style={{
          background: "rgba(99,102,241,0.1)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: "10px",
          padding: "12px",
          fontSize: "13px",
          color: "var(--txid-text)",
          lineHeight: 1.5,
        }}>
          📢 {community.announcement}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update WidgetConfig type and tab render logic**

In the `WidgetConfig` interface at the top of `WidgetApp.tsx`, add the new fields:

```typescript
interface WidgetConfig {
  // ... existing fields ...
  mode?: "support" | "token"
  community?: {
    discord: string | null
    twitter: string | null
    telegram: string | null
    website: string | null
    whitepaper: string | null
    announcement: string | null
  } | null
  tokenModeAsk?: string | null
}
```

Then update the `Tab` type and tab bar to be mode-aware. Replace the existing `Tab` type and tab bar rendering:

```typescript
// In the component, derive tabs based on mode:
const isTokenMode = config?.mode === "token"
const TABS = isTokenMode
  ? [
      { id: "trade",     label: "Trade" },
      { id: "community", label: "Community" },
      { id: "ask",       label: "Ask" },
    ]
  : [
      { id: "chat",   label: "Chat" },
      { id: "wallet", label: "Wallet" },
      { id: "info",   label: "Info" },
    ]
```

In the tab content render block, add the token mode cases:

```typescript
{/* Token Mode tabs */}
{isTokenMode && tab === "trade" && config?.token && (
  <TradeTab
    dexData={dexData}
    dexLoading={dexLoading}
    token={config.token}
    primaryColor={config.branding?.primaryColor ?? "#6366f1"}
  />
)}
{isTokenMode && tab === "community" && (
  <CommunityTab community={config?.community ?? null} />
)}
{isTokenMode && tab === "ask" && (
  <div className="flex h-full flex-col">
    <div className="flex-1 space-y-3 overflow-y-auto p-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}
        >
          {m.role === "assistant" && (
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: b.primaryColor, color: b.textColor }}
            >
              AI
            </div>
          )}
          <div
            className="max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
            style={{
              backgroundColor: m.role === "user" ? b.primaryColor : b.secondaryColor,
              color: b.textColor,
              borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
            }}
          >
            {m.content || (m.streaming && (
              <span className="inline-flex items-center gap-1 opacity-60">
                <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "0ms" }} />
                <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "150ms" }} />
                <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "300ms" }} />
              </span>
            ))}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
    <div
      className="shrink-0 flex items-center gap-2 border-t px-3 py-2"
      style={{ borderColor: `var(--w-border)` }}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
        placeholder="Ask anything…"
        disabled={isStreaming}
        className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
        style={{ color: b.textColor }}
      />
      <button
        onClick={sendMessage}
        disabled={isStreaming || !input.trim()}
        className="flex size-7 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
        style={{ backgroundColor: b.primaryColor }}
      >
        {isStreaming ? (
          <Loader2Icon className="size-3.5 animate-spin" style={{ color: b.textColor }} />
        ) : (
          <SendIcon className="size-3.5" style={{ color: b.textColor }} />
        )}
      </button>
    </div>
  </div>
)}
```

Note: For the Ask tab, copy the existing chat tab JSX (messages list + input bar) verbatim — the `/api/chat` endpoint already handles the mode-aware prompt.

- [ ] **Step 5: Full build check**

```bash
pnpm --filter @txid/app build 2>&1 | grep -E "(✓ Compiled|Type error|Error)" | head -15
```
Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/widget/WidgetApp.tsx
git commit -m "feat: Token Mode widget — Trade, Community, Ask tabs with DexScreener"
```

---

## Task 14: Marketing Site Updates

**Files:**
- Modify: `apps/web/components/sections/Hero.tsx`
- Create: `apps/web/components/sections/ThreeModes.tsx`
- Modify: `apps/web/components/sections/PricingSection.tsx`
- Modify: `apps/web/components/sections/FeatureGrid.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Update Hero copy**

In `apps/web/components/sections/Hero.tsx`, update the headline and subheading:

```tsx
<h1 className="font-display text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
  The embedded{" "}
  <span className="text-accent">Web3 intelligence</span>{" "}
  layer.
</h1>
<p className="text-muted text-lg max-w-xl">
  For protocols that need AI support, projects launching tokens, and developers
  building on-chain. One widget. Three modes.
</p>
```

- [ ] **Step 2: Create ThreeModes.tsx**

```tsx
// apps/web/components/sections/ThreeModes.tsx
import { FadeIn } from "@/components/ui/FadeIn"

const MODES = [
  {
    emoji: "🏛️",
    title: "Protocol",
    audience: "DeFi protocols & dApps",
    features: ["AI-powered user support", "Transaction diagnostics", "Docs Q&A via RAG", "Multi-chain wallet detection"],
    cta: "Get started",
    href: "https://app.txid.support/sign-up",
    highlight: true,
  },
  {
    emoji: "🪙",
    title: "Project",
    audience: "Token projects & DAOs",
    features: ["Live price & 24h chart", "Buy button → best DEX", "Community links", "Lightweight AI chat"],
    cta: "Get started",
    href: "https://app.txid.support/sign-up",
    highlight: false,
  },
  {
    emoji: "👤",
    title: "Individual",
    audience: "Coming soon",
    features: ["Public wallet page", "Portfolio context", "Shareable URL", "Onchain identity"],
    cta: "Join waitlist",
    href: "#",
    highlight: false,
    comingSoon: true,
  },
]

export function ThreeModes() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-12">
            <p className="font-mono text-sm text-accent mb-3">{"// Three modes"}</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              One widget, built for your use case
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Select the mode that fits when you create your project. The widget, dashboard, and AI adapt automatically.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {MODES.map((mode, i) => (
            <FadeIn key={mode.title} delay={i * 0.1}>
              <div className={`relative flex flex-col rounded-2xl border p-6 h-full ${
                mode.highlight
                  ? "border-accent bg-accent/5"
                  : mode.comingSoon
                  ? "border-[var(--border)] bg-[var(--bg-surface)] opacity-60"
                  : "border-[var(--border)] bg-[var(--bg-surface)]"
              }`}>
                {mode.comingSoon && (
                  <span className="absolute top-4 right-4 text-xs font-mono text-muted border border-[var(--border)] rounded-full px-2 py-0.5">
                    Soon
                  </span>
                )}
                <div className="text-3xl mb-3">{mode.emoji}</div>
                <h3 className="font-display text-xl font-bold text-white mb-1">{mode.title}</h3>
                <p className="text-sm text-muted mb-4">{mode.audience}</p>
                <ul className="flex-1 space-y-2 mb-6">
                  {mode.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="text-accent">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {!mode.comingSoon && (
                  <a
                    href={mode.href}
                    className={`block text-center rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                      mode.highlight
                        ? "bg-accent text-white hover:bg-accent/90"
                        : "bg-[var(--bg-elevated)] text-white border border-[var(--border)] hover:border-accent"
                    }`}
                  >
                    {mode.cta}
                  </a>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Update PricingSection to four tiers**

Replace the `PLANS` array in `apps/web/components/sections/PricingSection.tsx`:

```tsx
const PLANS = [
  {
    name: "Token Starter",
    price: "Free",
    period: "",
    description: "Get your token widget live in minutes.",
    features: [
      "1 token",
      "1,000 widget loads/mo",
      "TxID branding",
      "Live price + chart",
      "Community links",
    ],
    cta: "Get started free",
    href: "https://app.txid.support/sign-up?plan=token-starter",
    highlight: false,
  },
  {
    name: "Token Pro",
    price: "$29",
    period: "/mo",
    description: "White-label token widget for serious projects.",
    features: [
      "1 token",
      "10,000 widget loads/mo",
      "White-label (remove TxID branding)",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Start Token Pro",
    href: "https://app.txid.support/sign-up?plan=token-pro",
    highlight: false,
  },
  {
    name: "Support Starter",
    price: "$49",
    period: "/mo",
    description: "Full AI support for your protocol.",
    features: [
      "1 project",
      "5,000 conversations/mo",
      "AI support + tx diagnostics",
      "Docs RAG knowledge base",
      "White-label",
      "Analytics",
    ],
    cta: "Start Support",
    href: "https://app.txid.support/sign-up?plan=support-starter",
    highlight: true,
  },
  {
    name: "Support Growth",
    price: "$149",
    period: "/mo",
    description: "Scale across multiple projects.",
    features: [
      "10 projects",
      "25,000 conversations/mo",
      "Everything in Starter",
      "Team seats",
      "Priority support",
    ],
    cta: "Start Growth",
    href: "https://app.txid.support/sign-up?plan=support-growth",
    highlight: false,
  },
]
```

Ensure the card rendering loop and highlight logic still works with the updated data shape (the existing JSX iterates over `PLANS` so it should be compatible).

- [ ] **Step 4: Add mode badges to FeatureGrid**

In `apps/web/components/sections/FeatureGrid.tsx`, add a `mode` field to each feature in the features array — either `"token"`, `"support"`, or `"both"`. Then render a small badge below each card title:

```tsx
{feature.mode === "token" && (
  <span className="text-[10px] font-mono text-accent border border-accent/30 rounded px-1.5 py-0.5">🪙 Token</span>
)}
{feature.mode === "support" && (
  <span className="text-[10px] font-mono text-muted border border-[var(--border)] rounded px-1.5 py-0.5">🏛️ Protocol</span>
)}
{feature.mode === "both" && (
  <span className="text-[10px] font-mono text-muted border border-[var(--border)] rounded px-1.5 py-0.5">🏛️🪙 Both</span>
)}
```

Assign modes: Auto Wallet Detection → support, Transaction Diagnostics → support, Docs Q&A → support, Live Token Price → token, White-Label → both, Embed Methods → both, Multi-Chain → both, Analytics → both.

- [ ] **Step 5: Insert ThreeModes into the marketing page**

In `apps/web/app/page.tsx`, import and insert `<ThreeModes />` between `<Hero />` and `<HowItWorks />` (per spec):

```tsx
import { ThreeModes } from "@/components/sections/ThreeModes"

// In JSX:
<Hero />
<ThreeModes />
<HowItWorks />
```

- [ ] **Step 6: Build the web app**

```bash
pnpm --filter @txid/web build 2>&1 | grep -E "(✓ Compiled|Type error|Error)" | head -10
```

- [ ] **Step 7: Commit**

```bash
git add \
  apps/web/components/sections/Hero.tsx \
  apps/web/components/sections/ThreeModes.tsx \
  apps/web/components/sections/PricingSection.tsx \
  apps/web/components/sections/FeatureGrid.tsx \
  apps/web/app/page.tsx
git commit -m "feat: marketing site — three-mode hero, ThreeModes section, updated pricing, mode badges"
```

---

## Task 15: Final Build + Push

- [ ] **Step 1: Full monorepo build**

```bash
cd /Users/howardpearce/Projects/txid-support/.worktrees/phase-1
pnpm build 2>&1 | grep -E "(✓|error|Error|ERR_)" | head -20
```
Expected: all three apps report `✓ Compiled successfully`.

- [ ] **Step 2: Add .superpowers to .gitignore**

```bash
echo ".superpowers/" >> .gitignore
git add .gitignore
```

- [ ] **Step 3: Push to remote**

```bash
git push origin phase/1-infrastructure
```

---

## Reference

- **Spec:** `docs/superpowers/specs/2026-03-27-mode-system-token-mode-design.md`
- **DexScreener API docs:** `https://docs.dexscreener.com/api/reference`
- **Widget runs at:** `https://app.txid.support/widget?key=pk_xxx`
- **Dashboard runs at:** `https://app.txid.support/dashboard`
- **Existing chat API:** `apps/app/app/api/chat/route.ts`
- **Existing widget config API:** `apps/app/app/api/widget-config/[key]/route.ts`
