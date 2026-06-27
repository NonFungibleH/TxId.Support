import Link from "next/link";
import { APP_URL } from "@/lib/config";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] mt-32">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/txid-icon-64.png" alt="TxID Support" className="h-7 w-7" />
              <span className="font-display font-semibold text-white text-sm tracking-tight">
                TxID Support
              </span>
            </Link>
            <p className="text-sm text-muted leading-relaxed">
              AI-powered support widget for DeFi protocols. Embed in 30 seconds.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
              Product
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link href="/#features" className="text-sm text-muted hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-muted hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/demo" className="text-sm text-muted hover:text-white transition-colors">
                  Demo
                </Link>
              </li>
              <li>
                <a href={`${APP_URL}/sign-up`} className="text-sm text-muted hover:text-white transition-colors">
                  Get started free
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
              Company
            </p>
            <ul className="space-y-2.5">
              <li>
                <a href="mailto:hello@txid.support" className="text-sm text-muted hover:text-white transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted hover:text-white transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted hover:text-white transition-colors">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted">
            © {year} TxID Support. All rights reserved.
          </p>
          <p className="text-xs font-mono text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
              Free trial available · No credit card required
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
