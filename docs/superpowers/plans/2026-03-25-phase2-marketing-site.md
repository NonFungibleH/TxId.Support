# Phase 2: Marketing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the txid.support marketing site — a dark, crypto-native landing page that converts DeFi protocol teams into paying customers.

**Architecture:** Next.js 14 App Router with custom components (no shadcn). All design tokens in CSS variables. Framer-motion for scroll animations. Four routes: / (homepage), /pricing, /demo (placeholder), /blog (stub).

**Tech Stack:** Next.js 14, Tailwind CSS v3, framer-motion, lucide-react, clsx, next/font/google (Space Grotesk + Inter + Space Mono)

**Worktree:** `/Users/howardpearce/Projects/txid-support/.worktrees/phase-1`

---

## File Map

### Modified
- `apps/web/app/layout.tsx` — Root layout: Google Fonts, metadata, html/body with font classes
- `apps/web/app/globals.css` — All design tokens as CSS vars, grid texture, base resets
- `apps/web/app/page.tsx` — Homepage: assembles all section components
- `apps/web/package.json` — Add framer-motion, lucide-react, clsx; add type-check script

### Created
- `apps/web/components/ui/FadeIn.tsx` — framer-motion scroll reveal wrapper
- `apps/web/components/ui/Button.tsx` — Primary/ghost/outline button variants
- `apps/web/components/ui/CodeBlock.tsx` — Syntax-coloured code with copy button
- `apps/web/components/layout/Navbar.tsx` — Top navigation with logo + links + CTAs
- `apps/web/components/layout/Footer.tsx` — Site footer with columns + copyright
- `apps/web/components/sections/Hero.tsx` — Hero with headline, CTAs, widget mockup
- `apps/web/components/sections/HowItWorks.tsx` — 3-step flow
- `apps/web/components/sections/FeatureGrid.tsx` — 8-feature grid
- `apps/web/components/sections/EmbedPreview.tsx` — Tabbed code preview
- `apps/web/components/sections/PricingSection.tsx` — 3-tier pricing cards (compact prop)
- `apps/web/components/sections/LogosBar.tsx` — Social proof bar
- `apps/web/components/sections/WidgetMockup.tsx` — Static widget preview for hero
- `apps/web/app/pricing/page.tsx` — Full pricing page with comparison table + FAQ
- `apps/web/app/demo/page.tsx` — Demo placeholder
- `apps/web/app/blog/page.tsx` — Blog stub

---

## Task 1: Install dependencies + add type-check script

**Files:**
- Modify: `apps/web/package.json`

- [ ] Install packages:
```bash
cd /Users/howardpearce/Projects/txid-support/.worktrees/phase-1
pnpm --filter @txid/web add framer-motion lucide-react clsx
```

- [ ] Add `type-check` script to `apps/web/package.json` scripts:
```json
"type-check": "tsc --noEmit"
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```
Expected: Build succeeds (same output as before — no code changed yet)

- [ ] Commit:
```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add framer-motion, lucide-react, clsx to marketing site"
```

---

## Task 2: Global styles + design tokens + grid texture

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] Replace `apps/web/app/globals.css` entirely with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Backgrounds */
  --bg-base: #070707;
  --bg-surface: #0f0f0f;
  --bg-elevated: #141414;

  /* Brand */
  --accent: #6366f1;
  --accent-hover: #4f46e5;
  --accent-muted: rgba(99, 102, 241, 0.12);

  /* Text */
  --text-primary: #fafafa;
  --text-muted: #71717a;
  --text-subtle: #3f3f46;

  /* Borders */
  --border: rgba(255, 255, 255, 0.06);
  --border-accent: rgba(99, 102, 241, 0.3);

  /* Status */
  --green: #22c55e;
  --red: #ef4444;
  --yellow: #f59e0b;
}

/* Base resets */
*, *::before, *::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--bg-base);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  position: relative;
  overflow-x: hidden;
}

/* Grid/circuit background texture */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 64px 64px;
}

/* Ensure content sits above texture */
#__next, main, header, footer, section {
  position: relative;
  z-index: 1;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-base); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* Selection */
::selection {
  background: rgba(99, 102, 241, 0.3);
  color: var(--text-primary);
}
```

- [ ] Verify build:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/app/globals.css
git commit -m "feat: global design tokens and grid texture for marketing site"
```

---

## Task 3: Root layout with Google Fonts

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] Replace `apps/web/app/layout.tsx` entirely with:

```tsx
import type { Metadata } from "next";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono-accent",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TxID Support — AI-Powered Web3 Support Widget",
  description:
    "White-label AI support widget for DeFi protocols. Auto-detects wallets, diagnoses transactions, answers docs questions. Embed in 30 seconds.",
  metadataBase: new URL("https://txid.support"),
  openGraph: {
    title: "TxID Support — AI-Powered Web3 Support Widget",
    description:
      "White-label AI support widget for DeFi protocols. Embed in 30 seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] Extend `apps/web/tailwind.config.ts` to expose the font CSS variables. Replace the content with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-mono-accent)", "monospace"],
      },
      colors: {
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-muted": "var(--accent-muted)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        border: "var(--border)",
        muted: "var(--text-muted)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/app/layout.tsx apps/web/tailwind.config.ts
git commit -m "feat: Google Fonts and Tailwind theme for marketing site"
```

---

## Task 4: FadeIn animation wrapper + Button component

**Files:**
- Create: `apps/web/components/ui/FadeIn.tsx`
- Create: `apps/web/components/ui/Button.tsx`

- [ ] Create `apps/web/components/ui/FadeIn.tsx`:

```tsx
"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}

export function FadeIn({
  children,
  delay = 0,
  className,
  direction = "up",
}: FadeInProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const directionMap = {
    up: { y: 24 },
    down: { y: -24 },
    left: { x: 24 },
    right: { x: -24 },
    none: {},
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] Create `apps/web/components/ui/Button.tsx`:

```tsx
import Link from "next/link";
import { clsx } from "clsx";

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  external?: boolean;
}

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  onClick,
  external,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer select-none";

  const variants = {
    primary:
      "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20",
    ghost: "text-muted hover:text-white hover:bg-white/5",
    outline:
      "border border-[var(--border)] text-white hover:border-accent hover:text-accent bg-transparent",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2",
  };

  const classes = clsx(base, variants[variant], sizes[size], className);

  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    ) : (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/components/
git commit -m "feat: FadeIn animation wrapper and Button component"
```

---

## Task 5: Navbar + Footer

**Files:**
- Create: `apps/web/components/layout/Navbar.tsx`
- Create: `apps/web/components/layout/Footer.tsx`

- [ ] Create `apps/web/components/layout/Navbar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Menu, X, Zap } from "lucide-react";
import { clsx } from "clsx";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "https://docs.txid.support", external: true },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[#070707]/90 backdrop-blur-md border-b border-[var(--border)]"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-semibold text-white">
            TxID Support
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm text-muted hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm text-muted hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Button href="https://app.txid.support/sign-in" variant="ghost" size="sm">
            Sign In
          </Button>
          <Button href="https://app.txid.support/sign-up" variant="primary" size="sm">
            Get Started Free
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-muted hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[#0f0f0f] border-b border-[var(--border)] px-6 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted hover:text-white transition-colors py-1"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Button href="https://app.txid.support/sign-in" variant="outline" size="sm" className="w-full justify-center">
              Sign In
            </Button>
            <Button href="https://app.txid.support/sign-up" variant="primary" size="sm" className="w-full justify-center">
              Get Started Free
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] Create `apps/web/components/layout/Footer.tsx`:

```tsx
import Link from "next/link";
import { Zap } from "lucide-react";

const FOOTER_LINKS = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Demo", href: "/demo" },
  ],
  Developers: [
    { label: "Documentation", href: "https://docs.txid.support" },
    { label: "GitHub", href: "https://github.com/NonFungibleH/TxId.Support" },
    { label: "npm Package", href: "https://www.npmjs.com/package/@txid/support" },
  ],
  Company: [
    { label: "Blog", href: "/blog" },
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] mt-32">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-semibold text-white">
                TxID Support
              </span>
            </Link>
            <p className="text-sm text-muted leading-relaxed">
              AI-powered support widget for DeFi protocols. Embed in 30 seconds.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                {title}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} TxID Support. All rights reserved.
          </p>
          <p className="text-xs font-mono text-muted">
            txid.support
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/components/layout/
git commit -m "feat: Navbar and Footer for marketing site"
```

---

## Task 6: Widget Mockup component

**Files:**
- Create: `apps/web/components/sections/WidgetMockup.tsx`

- [ ] Create `apps/web/components/sections/WidgetMockup.tsx`:

```tsx
import { CheckCircle2, XCircle, Wifi } from "lucide-react";
import { clsx } from "clsx";

const TRANSACTIONS = [
  { status: "success", label: "Swap ETH → USDC", time: "2m ago" },
  { status: "success", label: "Approve USDC", time: "1h ago" },
  { status: "failed", label: "Failed swap", time: "3h ago" },
];

const TABS = ["Support", "Token", "Content"];

export function WidgetMockup({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "w-80 rounded-2xl overflow-hidden shadow-2xl shadow-accent/10",
        "border border-[var(--border)] bg-[#0c0c0c]",
        "font-sans text-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
          <span className="font-display font-semibold text-white text-xs">
            TxID Support
          </span>
        </div>
        <Wifi className="w-3.5 h-3.5 text-muted" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={clsx(
              "flex-1 py-2 text-xs transition-colors",
              i === 0
                ? "text-accent border-b-2 border-accent font-medium"
                : "text-muted hover:text-white"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Greeting */}
        <div className="bg-[var(--bg-elevated)] rounded-xl p-3">
          <p className="text-white text-xs leading-relaxed">
            Hi 👋 I&apos;m your support agent. I can diagnose transactions and
            answer questions about the protocol.
          </p>
        </div>

        {/* Wallet */}
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="font-mono text-xs text-muted">
            0x1a2b...3c4d
          </span>
        </div>

        {/* Transactions */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted px-1">Recent transactions</p>
          {TRANSACTIONS.map((tx, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-[var(--bg-elevated)] rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {tx.status === "success" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                )}
                <span className="text-xs text-white">{tx.label}</span>
              </div>
              <span className="text-xs text-muted font-mono">{tx.time}</span>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 bg-[var(--bg-elevated)] rounded-xl px-3 py-2 border border-[var(--border)]">
          <span className="text-xs text-muted flex-1">
            Ask anything about your wallet...
          </span>
          <div className="w-5 h-5 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/components/sections/WidgetMockup.tsx
git commit -m "feat: static widget mockup for hero section"
```

---

## Task 7: Hero section

**Files:**
- Create: `apps/web/components/sections/Hero.tsx`

- [ ] Create `apps/web/components/sections/Hero.tsx`:

```tsx
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { WidgetMockup } from "./WidgetMockup";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <FadeIn delay={0}>
              <div className="inline-flex items-center gap-2 bg-accent-muted border border-[var(--border-accent)] rounded-full px-3 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-xs font-mono text-accent">
                  Now in beta — free for early protocols
                </span>
              </div>
            </FadeIn>

            <FadeIn delay={0.08}>
              <h1 className="font-display text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Support your users{" "}
                <span className="text-accent">on-chain</span>,{" "}
                not in Discord
              </h1>
            </FadeIn>

            <FadeIn delay={0.16}>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
                Embed an AI support widget that auto-detects connected wallets,
                diagnoses failed transactions in plain English, and answers
                questions from your docs — all in your brand.
              </p>
            </FadeIn>

            <FadeIn delay={0.24}>
              <div className="flex flex-wrap gap-3">
                <Button
                  href="https://app.txid.support/sign-up"
                  variant="primary"
                  size="lg"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/demo" variant="outline" size="lg">
                  <Play className="w-4 h-4" />
                  See Demo
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.32}>
              <p className="text-xs text-muted mt-4">
                No credit card required · Free tier includes 50 conversations/mo
              </p>
            </FadeIn>
          </div>

          {/* Right: widget mockup */}
          <FadeIn delay={0.2} direction="left" className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Glow behind widget */}
              <div
                className="absolute inset-0 rounded-2xl blur-3xl scale-95"
                style={{ background: "rgba(99, 102, 241, 0.15)" }}
              />
              <WidgetMockup className="relative" />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/components/sections/Hero.tsx
git commit -m "feat: hero section with headline, CTAs, and widget mockup"
```

---

## Task 8: How It Works + Feature Grid

**Files:**
- Create: `apps/web/components/sections/HowItWorks.tsx`
- Create: `apps/web/components/sections/FeatureGrid.tsx`

- [ ] Create `apps/web/components/sections/HowItWorks.tsx`:

```tsx
import { Code2, Settings, Rocket } from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const STEPS = [
  {
    icon: Code2,
    number: "01",
    title: "Embed",
    description:
      "Add one script tag to your site. Works with React, Next.js, or plain HTML. Takes under a minute.",
    code: `<script src="https://txid.support/widget.js"\n  data-key="YOUR_KEY"></script>`,
  },
  {
    icon: Settings,
    number: "02",
    title: "Configure",
    description:
      "Set your brand colours, upload your logo, paste your docs URL. Live preview updates in real time.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Go Live",
    description:
      "Your users get instant AI support — wallet detection, transaction diagnosis, docs Q&A — all in your brand.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">// How it works</p>
            <h2 className="font-display text-4xl font-bold text-white">
              Live in three steps
            </h2>
          </div>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <FadeIn key={step.number} delay={i * 0.1}>
              <div className="relative bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-accent)] transition-colors group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-accent" />
                  </div>
                  <span className="font-mono text-3xl font-bold text-white/5 group-hover:text-white/10 transition-colors select-none">
                    {step.number}
                  </span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {step.description}
                </p>
                {step.code && (
                  <pre className="mt-4 bg-[var(--bg-elevated)] rounded-lg px-3 py-2 text-xs font-mono text-accent/80 overflow-x-auto border border-[var(--border)]">
                    {step.code}
                  </pre>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] Create `apps/web/components/sections/FeatureGrid.tsx`:

```tsx
import {
  Wallet,
  Activity,
  BookOpen,
  TrendingUp,
  Palette,
  Code2,
  Globe2,
  BarChart3,
} from "lucide-react";
import { FadeIn } from "@/components/ui/FadeIn";

const FEATURES = [
  {
    icon: Wallet,
    title: "Auto Wallet Detection",
    description:
      "Silently reads the connected wallet — no prompts, no popups. Users are greeted by name before they ask a thing.",
  },
  {
    icon: Activity,
    title: "Transaction Diagnostics",
    description:
      "Paste any tx hash or let us find it automatically. Failed transactions are explained in plain English with a suggested fix.",
  },
  {
    icon: BookOpen,
    title: "Docs Q&A via RAG",
    description:
      "Paste your docs URL. The widget crawls, indexes, and answers questions grounded in your own documentation.",
  },
  {
    icon: TrendingUp,
    title: "Live Token Price",
    description:
      "Set your token contract address. Users see live price, 7-day chart, and a one-tap Buy button pointing to the best DEX.",
  },
  {
    icon: Palette,
    title: "Fully White-Label",
    description:
      "Your colours, your font, your logo. The widget looks native to your site — not a third-party plugin.",
  },
  {
    icon: Code2,
    title: "Three Embed Methods",
    description:
      "Script tag, inline div, or React npm package. All generate from your dashboard with one click to copy.",
  },
  {
    icon: Globe2,
    title: "Multi-Chain",
    description:
      "Ethereum, Base, BNB Chain, Polygon, Arbitrum, and Optimism — wallet history and transaction data across all of them.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "See total conversations, most-asked questions, wallet lookup counts, and satisfaction ratings in one place.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="font-mono text-sm text-accent mb-3">// Features</p>
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Everything a DeFi protocol needs
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Built specifically for Web3 — not a chatbot wrapper.
            </p>
          </div>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature, i) => (
            <FadeIn key={feature.title} delay={(i % 4) * 0.06}>
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors group h-full">
                <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
                  <feature.icon className="w-4.5 h-4.5 text-accent" style={{ width: '1.125rem', height: '1.125rem' }} />
                </div>
                <h3 className="font-display font-semibold text-white text-sm mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/components/sections/HowItWorks.tsx apps/web/components/sections/FeatureGrid.tsx
git commit -m "feat: How It Works and Feature Grid sections"
```

---

## Task 9: Embed Code Preview

**Files:**
- Create: `apps/web/components/sections/EmbedPreview.tsx`

- [ ] Create `apps/web/components/sections/EmbedPreview.tsx`:

```tsx
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
  // tsx — basic tokenization
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
            <p className="font-mono text-sm text-accent mb-3">// Integration</p>
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
              {/* Tab bar */}
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

              {/* Code */}
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
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/components/sections/EmbedPreview.tsx
git commit -m "feat: tabbed embed code preview with copy button"
```

---

## Task 10: Pricing Section + Logos Bar

**Files:**
- Create: `apps/web/components/sections/PricingSection.tsx`
- Create: `apps/web/components/sections/LogosBar.tsx`

- [ ] Create `apps/web/components/sections/PricingSection.tsx`:

```tsx
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { clsx } from "clsx";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: null,
    description: "For projects just getting started",
    cta: "Get Started",
    ctaHref: "https://app.txid.support/sign-up",
    highlight: false,
    features: [
      "50 conversations / month",
      "Wallet detection",
      "Transaction diagnostics",
      "Docs Q&A",
      "TxID Support branding",
      "Script tag embed",
    ],
  },
  {
    name: "Pro",
    price: "$199",
    period: "/mo",
    description: "For live protocols with real users",
    cta: "Start Free Trial",
    ctaHref: "https://app.txid.support/sign-up?plan=pro",
    highlight: true,
    badge: "Most Popular",
    features: [
      "5,000 conversations / month",
      "Custom branding (colours, font, logo)",
      "Token price + chart",
      "Analytics dashboard",
      "Team seats",
      "All 3 embed methods",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: null,
    description: "For high-volume protocols",
    cta: "Contact Sales",
    ctaHref: "mailto:hello@txid.support",
    highlight: false,
    features: [
      "Unlimited conversations",
      "Custom chains",
      "SLA guarantee",
      "Dedicated support",
      "Custom integrations",
      "SSO / SAML",
    ],
  },
];

export function PricingSection({ compact }: { compact?: boolean }) {
  return (
    <section className={clsx("py-24", compact && "pb-0")}>
      <div className="max-w-6xl mx-auto px-6">
        {compact && (
          <FadeIn>
            <div className="text-center mb-12">
              <p className="font-mono text-sm text-accent mb-3">// Pricing</p>
              <h2 className="font-display text-4xl font-bold text-white mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-muted max-w-xl mx-auto">
                Start free. Upgrade when you&apos;re ready.
              </p>
            </div>
          </FadeIn>
        )}

        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 0.08}>
              <div
                className={clsx(
                  "relative rounded-2xl border p-6 flex flex-col h-full transition-colors",
                  plan.highlight
                    ? "bg-accent-muted border-accent shadow-lg shadow-accent/10"
                    : "bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--border-accent)]"
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-display font-semibold text-white mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-muted mb-3">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-muted">{plan.period}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted">
                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  href={plan.ctaHref}
                  variant={plan.highlight ? "primary" : "outline"}
                  className="w-full justify-center"
                >
                  {plan.cta}
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] Create `apps/web/components/sections/LogosBar.tsx`:

```tsx
import { FadeIn } from "@/components/ui/FadeIn";

const LOGOS = [
  "Protocol Alpha",
  "DeFi Beta",
  "Chain Gamma",
  "Swap Delta",
  "Vault Epsilon",
];

export function LogosBar() {
  return (
    <section className="py-16 border-y border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6">
        <FadeIn>
          <p className="text-center text-xs font-mono text-muted uppercase tracking-widest mb-8">
            Trusted by DeFi protocols
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {LOGOS.map((name) => (
              <div
                key={name}
                className="h-7 flex items-center px-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]"
              >
                <span className="font-mono text-xs text-muted">{name}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/components/sections/PricingSection.tsx apps/web/components/sections/LogosBar.tsx
git commit -m "feat: pricing section and logos bar"
```

---

## Task 11: Assemble Homepage

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] Replace `apps/web/app/page.tsx` entirely with:

```tsx
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { EmbedPreview } from "@/components/sections/EmbedPreview";
import { PricingSection } from "@/components/sections/PricingSection";
import { LogosBar } from "@/components/sections/LogosBar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LogosBar />
        <HowItWorks />
        <FeatureGrid />
        <EmbedPreview />
        <PricingSection compact />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```
Expected: Build passes with homepage having all sections.

- [ ] Commit:
```bash
git add apps/web/app/page.tsx
git commit -m "feat: assemble homepage with all sections"
```

---

## Task 12: /pricing page

**Files:**
- Create: `apps/web/app/pricing/page.tsx`

- [ ] Create `apps/web/app/pricing/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PricingSection } from "@/components/sections/PricingSection";
import { FadeIn } from "@/components/ui/FadeIn";
import { Check, Minus } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing — TxID Support",
  description: "Start free. Upgrade when your protocol is ready.",
};

const COMPARISON = [
  {
    category: "Support",
    rows: [
      { feature: "Conversations / month", starter: "50", pro: "5,000", enterprise: "Unlimited" },
      { feature: "Wallet detection", starter: true, pro: true, enterprise: true },
      { feature: "Transaction diagnostics", starter: true, pro: true, enterprise: true },
      { feature: "Revert reason explainer", starter: true, pro: true, enterprise: true },
      { feature: "Docs Q&A (RAG)", starter: true, pro: true, enterprise: true },
    ],
  },
  {
    category: "Branding",
    rows: [
      { feature: "TxID Support branding", starter: true, pro: false, enterprise: false },
      { feature: "Custom colours + font", starter: false, pro: true, enterprise: true },
      { feature: "Custom logo", starter: false, pro: true, enterprise: true },
      { feature: "Token price + chart", starter: false, pro: true, enterprise: true },
    ],
  },
  {
    category: "Integration",
    rows: [
      { feature: "Script tag embed", starter: true, pro: true, enterprise: true },
      { feature: "React npm package", starter: false, pro: true, enterprise: true },
      { feature: "Multi-chain support", starter: true, pro: true, enterprise: true },
      { feature: "Custom chains", starter: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Team",
    rows: [
      { feature: "Team seats", starter: "1", pro: "5", enterprise: "Unlimited" },
      { feature: "Analytics dashboard", starter: false, pro: true, enterprise: true },
      { feature: "CSV export", starter: false, pro: true, enterprise: true },
      { feature: "SSO / SAML", starter: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Support",
    rows: [
      { feature: "Community support", starter: true, pro: true, enterprise: true },
      { feature: "Priority support", starter: false, pro: true, enterprise: true },
      { feature: "Dedicated support", starter: false, pro: false, enterprise: true },
      { feature: "SLA guarantee", starter: false, pro: false, enterprise: true },
    ],
  },
];

const FAQ = [
  {
    q: "What counts as a conversation?",
    a: "A conversation starts when a user opens the widget and sends their first message. It ends after 30 minutes of inactivity. Multiple messages in the same session count as one conversation.",
  },
  {
    q: "Can I use TxID Support without branding?",
    a: 'The free Starter plan includes "Powered by TxID Support" in the widget footer. Pro and Enterprise plans let you remove all TxID branding and use your own.',
  },
  {
    q: "What chains are supported?",
    a: "Ethereum, Base, BNB Chain, Polygon, Arbitrum, and Optimism are supported by default. Enterprise plans can add custom chains.",
  },
  {
    q: "How does the docs Q&A work?",
    a: "You paste your docs URL in the dashboard. Our system crawls and indexes it automatically using RAG (retrieval-augmented generation). The AI answers questions grounded in your documentation — not hallucinated.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no cancellation fees. Cancel from your dashboard and you'll retain access until the end of your billing period.",
  },
];

type CellValue = boolean | string;

function Cell({ value }: { value: CellValue }) {
  if (value === true) return <Check className="w-4 h-4 text-accent mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-muted mx-auto" />;
  return <span className="text-sm text-white">{value}</span>;
}

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        {/* Header */}
        <div className="max-w-6xl mx-auto px-6 text-center py-16">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">// Pricing</p>
            <h1 className="font-display text-5xl font-bold text-white mb-4">
              Start free. Scale when ready.
            </h1>
            <p className="text-lg text-muted max-w-xl mx-auto">
              No credit card required. The free tier is genuinely useful —
              not a 7-day trial.
            </p>
          </FadeIn>
        </div>

        {/* Pricing cards */}
        <PricingSection />

        {/* Comparison table */}
        <div className="max-w-5xl mx-auto px-6 py-24">
          <FadeIn>
            <h2 className="font-display text-2xl font-bold text-white text-center mb-12">
              Full feature comparison
            </h2>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 pr-4 text-sm font-medium text-muted w-1/2">Feature</th>
                    {["Starter", "Pro", "Enterprise"].map((plan) => (
                      <th key={plan} className="text-center py-3 px-4 text-sm font-display font-semibold text-white">
                        {plan}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((group) => (
                    <>
                      <tr key={group.category} className="border-t border-[var(--border)]">
                        <td colSpan={4} className="py-3 pr-4">
                          <span className="font-mono text-xs text-accent uppercase tracking-wider">
                            {group.category}
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr
                          key={row.feature}
                          className="border-b border-[var(--border)] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-4 text-sm text-muted">{row.feature}</td>
                          <td className="py-3 px-4 text-center"><Cell value={row.starter} /></td>
                          <td className="py-3 px-4 text-center"><Cell value={row.pro} /></td>
                          <td className="py-3 px-4 text-center"><Cell value={row.enterprise} /></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto px-6 pb-24">
          <FadeIn>
            <h2 className="font-display text-2xl font-bold text-white text-center mb-10">
              Frequently asked questions
            </h2>
          </FadeIn>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <FadeIn key={item.q} delay={i * 0.05}>
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
                  <p className="font-display font-semibold text-white mb-2 text-sm">
                    {item.q}
                  </p>
                  <p className="text-sm text-muted leading-relaxed">{item.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/app/pricing/
git commit -m "feat: full /pricing page with comparison table and FAQ"
```

---

## Task 13: /demo + /blog stub pages

**Files:**
- Create: `apps/web/app/demo/page.tsx`
- Create: `apps/web/app/blog/page.tsx`

- [ ] Create `apps/web/app/demo/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { WidgetMockup } from "@/components/sections/WidgetMockup";

export const metadata: Metadata = {
  title: "Demo — TxID Support",
  description: "See the TxID Support widget in action.",
};

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">// Demo</p>
            <h1 className="font-display text-5xl font-bold text-white mb-4">
              See it in action
            </h1>
            <p className="text-lg text-muted max-w-lg mx-auto mb-12">
              The interactive demo is coming soon. Sign up to get early access
              and be the first to test it on your protocol.
            </p>
          </FadeIn>

          <FadeIn delay={0.1} className="flex justify-center mb-12">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-2xl blur-3xl scale-90"
                style={{ background: "rgba(99, 102, 241, 0.2)" }}
              />
              <WidgetMockup className="relative" />
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Button
              href="https://app.txid.support/sign-up"
              variant="primary"
              size="lg"
            >
              Get Early Access
            </Button>
          </FadeIn>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] Create `apps/web/app/blog/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "Blog — TxID Support",
};

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center pt-24">
        <FadeIn className="text-center px-6">
          <p className="font-mono text-sm text-accent mb-3">// Blog</p>
          <h1 className="font-display text-4xl font-bold text-white mb-4">
            Coming soon
          </h1>
          <p className="text-muted">
            Guides, updates, and deep-dives on Web3 support.
          </p>
        </FadeIn>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] Verify:
```bash
pnpm --filter @txid/web build
```

- [ ] Commit:
```bash
git add apps/web/app/demo/ apps/web/app/blog/
git commit -m "feat: /demo placeholder and /blog stub"
```

---

## Task 14: Final verification + push

- [ ] Full build + type-check:
```bash
cd /Users/howardpearce/Projects/txid-support/.worktrees/phase-1
pnpm turbo run build type-check
```
Expected: All tasks pass (exit 0)

- [ ] Push to master:
```bash
git push origin phase/1-infrastructure:master
```

- [ ] Close out worktree (Phase 1 branch is now complete):
```bash
cd /Users/howardpearce/Projects/txid-support
git fetch origin
git merge origin/master --ff-only
```
