import Link from "next/link";
import { APP_URL } from "@/lib/config";

const PRODUCT_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Demo", href: "/demo" },
  { label: "Blog", href: "/blog" },
  { label: "Get started free", href: `${APP_URL}/sign-up`, external: true },
];

const LEGAL_LINKS = [
  { label: "Contact", href: "mailto:hello@txid.support", external: true },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">

          {/* Brand */}
          <div className="shrink-0">
            <Link href="/" className="flex items-center gap-2 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/txid-icon-64.png" alt="TxID Support" className="h-6 w-6" />
              <span className="font-display font-semibold text-white text-sm tracking-tight">
                TxID Support
              </span>
            </Link>
            <p className="text-xs text-muted leading-relaxed max-w-[200px]">
              AI support for DeFi protocols.<br />Embed in 30 seconds.
            </p>
          </div>

          {/* Links — two tight columns */}
          <div className="flex gap-12">
            <div>
              <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">
                Product
              </p>
              <ul className="space-y-2">
                {PRODUCT_LINKS.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} className="text-xs text-muted hover:text-white transition-colors">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-xs text-muted hover:text-white transition-colors">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted/50 uppercase tracking-wider mb-3">
                Company
              </p>
              <ul className="space-y-2">
                {LEGAL_LINKS.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} className="text-xs text-muted hover:text-white transition-colors">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-xs text-muted hover:text-white transition-colors">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted/50">
            © {year} TxID Support. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-mono text-muted/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
              Free trial available · No credit card required
            </p>
            <a
              href="https://www.3uild.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted/40 hover:text-muted/70 transition-colors"
            >
              Built by 3UILD
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
