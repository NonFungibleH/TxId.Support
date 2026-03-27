# Phase 2 Design: Mode System + Token Mode

**Date:** 2026-03-27
**Status:** Approved
**Scope:** TxID Support monorepo — `apps/app`, `apps/web`, `packages/ai`, `supabase/migrations`

---

## Overview

Phase 2 introduces a mode system that splits TxID Support into two distinct product experiences: **Support Mode** (existing) and **Token Mode** (new). A dedicated onboarding wizard lets users choose their mode at project creation. The widget, dashboard, and marketing site all adapt to the selected mode.

Personal Mode (individual wallet pages) is deferred to a future phase.

---

## 1. Data Model

### 1.1 New `projects.mode` column

```sql
ALTER TABLE projects
  ADD COLUMN mode text NOT NULL DEFAULT 'support'
  CONSTRAINT projects_mode_check CHECK (mode IN ('support', 'token'));
```

- Existing rows default to `'support'` — no data migration needed.
- The `/api/widget-config/[key]` endpoint adds `mode` to its response so the widget can read it at runtime.

### 1.2 `CommunityConfig` type

Added to `apps/app/lib/types/config.ts`:

```typescript
export interface CommunityConfig {
  discord:      string | null
  twitter:      string | null
  telegram:     string | null
  website:      string | null
  whitepaper:   string | null
  announcement: string | null  // plain text block shown in widget Community tab
}
```

`ProjectConfig` gains a new optional field:

```typescript
community: CommunityConfig | null
```

`DEFAULT_CONFIG` initialises `community` to `null`.

### 1.3 Widget config API response

`/api/widget-config/[key]/route.ts` adds to its returned object:

```typescript
{
  mode: project.mode,          // 'support' | 'token'
  community: config.community, // CommunityConfig | null
  // ... existing fields unchanged
}
```

---

## 2. Onboarding Wizard

### 2.1 Route

New route: `apps/app/app/onboarding/page.tsx`

Clerk's `afterSignUpUrl` is updated from `/dashboard` to `/onboarding`.

### 2.2 Flow

```
Sign up → /onboarding
  Step 1: Mode selection
    - Card A: 🏛️ Protocol — AI user support & transaction diagnostics
    - Card B: 🪙 Project — Token showcase & trading widget
  Step 2: Project name (text input)
  Submit → createProjectWithMode(name, mode) → redirect /dashboard
```

Both steps live on a single page with client-side state — no separate routes per step. The submit button is disabled until both a mode and a name are provided.

### 2.3 Server action

New server action `createProjectWithMode(name: string, mode: 'support' | 'token')` in `apps/app/lib/actions/project.ts`. Mirrors the existing `createProject` action but sets the `mode` column on insert.

### 2.4 Fallback

The existing `CreateProjectForm` on `/dashboard` remains unchanged as a fallback for edge cases (existing users, direct navigation).

---

## 3. Token Mode Widget

### 3.1 Tab structure

Token Mode replaces the current three tabs (Chat / Wallet / Info) with:

| Tab | Content |
|---|---|
| **Trade** | Live price, 24h change, market cap, volume, liquidity from DexScreener; 7-day sparkline; "Buy [TOKEN]" CTA → `token.dexUrl`; copyable contract address with explorer link |
| **Community** | Icon-button links (Discord, Twitter/X, Telegram, Website, Whitepaper); announcement text block below links if configured |
| **Ask** | AI chat via existing `/api/chat` endpoint; simplified system prompt (no RAG, no tx diagnostics) |

Support Mode widget is **unchanged**.

### 3.2 DexScreener integration

- Data fetched **client-side** directly from DexScreener's public API (no API key required, CORS-friendly).
- Endpoint: `https://api.dexscreener.com/latest/dex/tokens/{address}` — returns all pairs; widget picks the pair matching the configured chain.
- Data refreshed every 30 seconds via `setInterval`.
- On error or missing data, Trade tab shows a graceful fallback state ("Price data unavailable").
- No server-side proxy needed.

### 3.3 Sparkline

7-day price chart rendered as a minimal SVG path (no recharts — too heavy for the widget bundle). Uses the DexScreener `priceHistory` data if available, otherwise skips the chart.

### 3.4 Widget mode detection

`WidgetApp.tsx` reads `config.mode` from the fetched widget config. If `mode === 'token'`, renders the Token Mode tab set. If `mode === 'support'` (or absent), renders the existing Support Mode tabs. No other changes to the widget shell.

---

## 4. Dashboard — Mode Awareness

### 4.1 Sidebar

`Sidebar.tsx` receives the current project's `mode` as a prop (passed down from the dashboard layout server component, which reads `project.mode`).

**Support Mode nav items** (unchanged, 10 items):
Overview, Branding, Token, Smart Contracts, Docs & KB, Chains, Content, Embed, Analytics, Team

**Token Mode nav items** (7 items):
Overview, Branding, Token, Community, Ask AI, Embed, Analytics

### 4.2 New dashboard pages (Token Mode only)

**`/dashboard/community`**
Form with fields for each `CommunityConfig` property: Discord, Twitter/X, Telegram, Website, Whitepaper (URL inputs), and Announcement (textarea). Saves via `updateConfig`. Visible only in Token Mode sidebar.

**`/dashboard/ask`**
Minimal page with a textarea for FAQ/context text that seeds the Ask AI tab. Saves as a short knowledge base entry (plain text ingest via existing `ingestText` action). Visible only in Token Mode sidebar.

### 4.3 Dashboard layout

`apps/app/app/dashboard/layout.tsx` passes `project.mode` to `<Sidebar>`. No other layout changes.

---

## 5. Marketing Site

### 5.1 Hero

Updated headline and subheading in `Hero.tsx` to reflect the multi-mode positioning:

> **The embedded Web3 intelligence layer.**
> For protocols that need AI support, projects that want a token widget, and anyone who wants to make their corner of Web3 smarter.

### 5.2 New "Three Modes" section

New component `ThreeModes.tsx` inserted between Hero and HowItWorks. Three cards, one per mode:

- 🏛️ **Protocol** — AI-powered support, tx diagnostics, docs Q&A
- 🪙 **Project** — Live token price, trading CTA, community links
- 👤 **Individual** — *Coming soon* (greyed out, no CTA)

### 5.3 Pricing

`PricingSection.tsx` updated to four tiers:

| Tier | Price | Target |
|---|---|---|
| Token Starter | Free | Project — 1 token, TxID branding, 1,000 widget loads/mo |
| Token Pro | $29/mo | Project — white-label, 10,000 loads/mo, analytics |
| Support Starter | $49/mo | Protocol — AI support, docs RAG, 5,000 conversations/mo |
| Support Growth | $149/mo | Protocol — 10 projects, 25,000 conversations/mo, team seats |

Enterprise remains (custom). Old three-tier structure (Free / Pro $199 / Enterprise) is replaced.

### 5.4 Feature grid

`FeatureGrid.tsx` — each feature card gains a mode badge (🪙 Token / 🏛️ Protocol / both). No structural changes.

---

## 6. File Change Summary

| File | Change |
|---|---|
| `supabase/migrations/20260327000002_add_mode.sql` | New — adds `mode` column |
| `apps/app/lib/types/config.ts` | Add `CommunityConfig`, `community` field, update `DEFAULT_CONFIG` |
| `apps/app/lib/actions/project.ts` | Add `createProjectWithMode` action |
| `apps/app/app/onboarding/page.tsx` | New — wizard component |
| `apps/app/app/dashboard/layout.tsx` | Pass `mode` to Sidebar |
| `apps/app/components/dashboard/Sidebar.tsx` | Mode-aware nav items |
| `apps/app/app/dashboard/community/page.tsx` | New — community config page |
| `apps/app/app/dashboard/ask/page.tsx` | New — ask AI config page |
| `apps/app/app/widget/WidgetApp.tsx` | Add Token Mode tab set |
| `apps/app/app/api/widget-config/[key]/route.ts` | Return `mode` + `community` |
| `apps/web/components/sections/Hero.tsx` | Updated copy |
| `apps/web/components/sections/ThreeModes.tsx` | New — three-mode cards |
| `apps/web/components/sections/PricingSection.tsx` | Updated four-tier pricing |
| `apps/web/components/sections/FeatureGrid.tsx` | Add mode badges |
| `apps/web/app/page.tsx` | Insert ThreeModes section |

---

## 7. Out of Scope (This Phase)

- Personal Mode (individual wallet pages, `txid.support/@handle`)
- NFT/Assets tab (OpenSea/Blur API)
- Automatic docs crawling (Pro plan feature)
- Team seats / billing integration
- Mode switching after project creation
