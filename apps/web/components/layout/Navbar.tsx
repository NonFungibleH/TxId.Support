"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Menu, X, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { APP_URL } from "@/lib/config";

// Solutions groups the three products rather than being a page of its own:
// the offering IS three ways into one engine, and a flat nav could not say so.
const SOLUTIONS: NavLink[] = [
  { label: "SDK", href: "/sdk", blurb: "Answer the user inside your product" },
  { label: "API", href: "/api", blurb: "Put the answer in your own interface" },
  { label: "Console", href: "/console", blurb: "Give your support team the chain" },
];

const NAV_LINKS: NavLink[] = [
  { label: "Solutions", href: "/sdk", children: SOLUTIONS },
  { label: "Chains", href: "/chains" },
  { label: "Trust", href: "/security" },
  { label: "Try it live", href: "/check", highlight: true },
];

type NavLink = {
  label: string;
  href: string;
  highlight?: boolean;
  blurb?: string;
  children?: NavLink[];
};

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
          ? "bg-[#0b0c14]/90 backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/txid-icon-64.png" alt="TxID" className="h-7 w-7" />
          <span className="font-display font-semibold text-white text-sm tracking-tight">
            TxID
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) =>
            link.children ? (
              // Hover AND focus-within, so the group is reachable by keyboard.
              <div key={link.label} className="relative group">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-muted hover:text-white transition-colors inline-flex items-center gap-1"
                  aria-haspopup="true"
                >
                  {link.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-all absolute left-0 top-full pt-2 w-72">
                  <div className="rounded-xl border border-[var(--border)] bg-elevated p-2 shadow-xl">
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-lg px-3 py-2.5 hover:bg-surface transition-colors"
                      >
                        <span className="block text-sm font-semibold text-white">{child.label}</span>
                        {child.blurb && (
                          <span className="block text-xs text-muted mt-0.5">{child.blurb}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : link.highlight ? (
              <Link
                key={link.href}
                href={link.href}
                className="ml-1 px-3 py-1.5 text-sm font-semibold text-accent border border-accent/30 rounded-full hover:bg-accent/10 transition-colors"
              >
                {link.label}
              </Link>
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

        <div className="hidden md:flex items-center gap-2">
          <Button href={`${APP_URL}/sign-in`} variant="ghost" size="sm">
            Sign In
          </Button>
          <Button href="mailto:team@txid.support?subject=TxID early access" variant="primary" size="sm">
            Request Access
          </Button>
        </div>

        <button
          className="md:hidden text-muted hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-[#0f1020] border-b border-[var(--border)] px-6 py-4 flex flex-col gap-3">
          {NAV_LINKS.map((link) =>
            link.children ? (
              // No disclosure toggle on mobile: the group is three items, and
              // hiding them behind a tap is friction with nothing gained.
              <div key={link.label} className="flex flex-col gap-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-subtle">
                  {link.label}
                </span>
                {link.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className="text-sm text-muted hover:text-white transition-colors py-1 pl-3"
                    onClick={() => setOpen(false)}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "text-sm transition-colors py-1",
                  link.highlight ? "text-accent font-semibold" : "text-muted hover:text-white"
                )}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <div className="pt-2 flex flex-col gap-2">
            <Button href={`${APP_URL}/sign-in`} variant="outline" size="sm" className="w-full justify-center">
              Sign In
            </Button>
            <Button href="mailto:team@txid.support?subject=TxID early access" variant="primary" size="sm" className="w-full justify-center">
              Request Access
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
