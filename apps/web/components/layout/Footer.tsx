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
          <p className="text-xs font-mono text-muted">txid.support</p>
        </div>
      </div>
    </footer>
  );
}
