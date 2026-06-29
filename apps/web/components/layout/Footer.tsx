import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { APP_URL } from "@/lib/config";

const NAV = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Get started free", href: `${APP_URL}/sign-up`, external: true },
];

const LEGAL = [
  { label: "Contact", href: "mailto:hello@txid.support", external: true },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

function NavLink({ label, href, external }: { label: string; href: string; external?: boolean }) {
  const cls = "inline-flex items-center gap-1 text-sm text-muted hover:text-white transition-colors";
  const isNewTab = external && !href.startsWith("mailto");
  return external ? (
    <a href={href} className={cls} target={isNewTab ? "_blank" : undefined} rel={isNewTab ? "noopener noreferrer" : undefined}>
      {label}
      {isNewTab && <ExternalLink className="w-3 h-3 opacity-40" />}
    </a>
  ) : (
    <Link href={href} className={cls}>{label}</Link>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Main row */}
        <div className="flex flex-col md:flex-row md:items-center gap-10">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/txid-icon-64.png" alt="TxID Support" className="h-5 w-5" />
            <span className="font-display font-semibold text-white text-sm tracking-tight">
              TxID Support
            </span>
          </Link>

          {/* Nav groups */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-6">
              {NAV.map((l) => <NavLink key={l.label} {...l} />)}
            </div>
            <div className="w-px h-4 bg-[var(--border)] hidden md:block" />
            <div className="flex items-center gap-6">
              {LEGAL.map((l) => <NavLink key={l.label} {...l} />)}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-6 pt-5 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted/50">© {year} TxID Support. All rights reserved.</p>
          <a
            href="https://www.3uild.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted/40 hover:text-muted/70 transition-colors"
          >
            Built by 3UILD
            <ExternalLink className="w-2.5 h-2.5 opacity-40" />
          </a>
        </div>
      </div>
    </footer>
  );
}
