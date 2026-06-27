import Link from "next/link";
import { APP_URL } from "@/lib/config";

const LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Get started free", href: `${APP_URL}/sign-up`, external: true },
  { label: "Contact", href: "mailto:hello@txid.support", external: true },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          {/* Brand + links */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/" className="flex items-center gap-1.5 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/txid-icon-64.png" alt="TxID Support" className="h-4 w-4" />
              <span className="font-display font-semibold text-white text-xs tracking-tight">
                TxID Support
              </span>
            </Link>
            {LINKS.map((l) =>
              l.external ? (
                <a
                  key={l.label}
                  href={l.href}
                  className="text-xs text-muted hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-xs text-muted hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              )
            )}
          </div>

          {/* Right: copyright + credit */}
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-[11px] text-muted/50">© {year} TxID Support</p>
            <span className="text-muted/30">·</span>
            <a
              href="https://www.3uild.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted/40 hover:text-muted/70 transition-colors"
            >
              Built by 3UILD
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
