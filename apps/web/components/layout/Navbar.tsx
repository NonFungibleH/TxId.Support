"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Menu, X } from "lucide-react";
import { clsx } from "clsx";
import { APP_URL } from "@/lib/config";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Demo", href: "/demo" },
  { label: "Blog", href: "/blog" },
];

type NavLink = { label: string; href: string; highlight?: boolean };

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
          <img src="/brand/txid-icon-64.png" alt="TxID Support" className="h-7 w-7" />
          <span className="font-display font-semibold text-white text-sm tracking-tight">
            TxID Support
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {(NAV_LINKS as NavLink[]).map((link) => (
            link.highlight ? (
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
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button href={`${APP_URL}/sign-in`} variant="ghost" size="sm">
            Sign In
          </Button>
          <Button href={`${APP_URL}/sign-up`} variant="primary" size="sm">
            Get Started Free
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
          {(NAV_LINKS as NavLink[]).map((link) => (
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
          ))}
          <div className="pt-2 flex flex-col gap-2">
            <Button href={`${APP_URL}/sign-in`} variant="outline" size="sm" className="w-full justify-center">
              Sign In
            </Button>
            <Button href={`${APP_URL}/sign-up`} variant="primary" size="sm" className="w-full justify-center">
              Get Started Free
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
