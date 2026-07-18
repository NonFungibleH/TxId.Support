import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck, ScanSearch, FileCheck2, ScrollText, Ban, BookLock,
  Eye, Database, KeyRound, ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { APP_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Security & Trust | TxID Support",
  description:
    "How TxID Support keeps your protocol safe: read-only by design, no custody, no financial advice, and live on-chain checks your users can verify for themselves.",
  alternates: { canonical: "/security" },
};

const SAFE = [
  {
    icon: Ban,
    title: "No custody, no advice",
    description:
      "The assistant never touches funds, never asks for keys, and never tells users what to buy. There is nothing it can do to move or access assets.",
  },
  {
    icon: BookLock,
    title: "Grounded, bounded answers",
    description:
      "Scoped to your protocol and your documentation. It reads real chain state instead of guessing, and declines what it cannot verify.",
  },
  {
    icon: ScrollText,
    title: "Audit-logged support",
    description:
      "Every conversation is stored with a full record of what was asked and answered: a reviewable support trail for your team.",
  },
];

const VERIFY = [
  {
    icon: ScanSearch,
    title: "OFAC sanctions screening, on demand",
    description:
      "When a user asks whether an address or counterparty is flagged, the assistant screens it live against the on-chain Chainalysis sanctions oracle (OFAC SDN list) and cites the source.",
  },
  {
    icon: ShieldCheck,
    title: "Contract verification, on request",
    description:
      "Ask “is this the real contract?” and it confirms source-verified status from the block explorer, including proxy transparency and upgrade history.",
  },
  {
    icon: FileCheck2,
    title: "Audits, cited with sources",
    description:
      "List your audits in the dashboard and the assistant cites them by auditor, with a link to the report, whenever users ask if the protocol is safe.",
  },
];

const DATA = [
  {
    icon: Eye,
    title: "What it reads",
    body: "The public wallet address of a connected wallet, and public on-chain data such as balances and transactions. Exactly what any block explorer can already see.",
  },
  {
    icon: Database,
    title: "What we store",
    body: "Wallet addresses only as part of conversation records, plus the messages exchanged, your project configuration, and usage counts. Conversation data is retained for 12 months and can be deleted on request.",
  },
  {
    icon: KeyRound,
    title: "What we never touch",
    body: "Private keys, seed phrases, or signing permission of any kind. The assistant has no path to request a signature or move funds, so there is nothing to leak.",
  },
];

function Card({ icon: Icon, title, description }: { icon: typeof Ban; title: string; description: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-accent)] transition-colors group h-full">
      <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors">
        <Icon className="w-[1.125rem] h-[1.125rem] text-accent" />
      </div>
      <h3 className="font-display font-semibold text-white text-sm mb-1.5">{title}</h3>
      <p className="text-xs text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function Group({ label, blurb, items }: { label: string; blurb: string; items: typeof SAFE }) {
  return (
    <div>
      <FadeIn>
        <div className="mb-4">
          <h2 className="font-display text-xl font-semibold text-white">{label}</h2>
          <p className="text-sm text-muted mt-1 max-w-2xl">{blurb}</p>
        </div>
      </FadeIn>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <FadeIn key={item.title} delay={(i % 3) * 0.06}>
            <Card {...item} />
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* Hero */}
          <FadeIn>
            <div className="max-w-2xl">
              <p className="font-mono text-sm text-accent mb-3">Security &amp; trust</p>
              <h1 className="font-display text-4xl lg:text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                Add an AI to your protocol without adding risk
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                Bolting a chatbot onto a dapp usually means new attack surface and a
                bot that could give bad financial advice in your name. TxID does
                neither: it is read-only by design, holds nothing, and can prove
                what it tells your users with live on-chain data.
              </p>
            </div>
          </FadeIn>

          {/* Groups */}
          <div className="mt-16 space-y-12">
            <Group
              label="Safe by design"
              blurb="Structural guarantees. Nothing to configure, and nothing that can go wrong."
              items={SAFE}
            />
            <Group
              label="Ask and verify"
              blurb="Users never have to take the bot's word for it. They can ask it to prove things, live on-chain, with the source cited."
              items={VERIFY}
            />
          </div>

          {/* Actions (optional) */}
          <div className="mt-16">
            <FadeIn>
              <div className="mb-4">
                <h2 className="font-display text-xl font-semibold text-white">Actions (optional)</h2>
                <p className="text-sm text-muted mt-1 max-w-2xl">
                  On paid plans, a protocol can opt in to Actions: users ask the assistant to
                  perform something (a swap, a stake, a claim), it prepares the transaction, and
                  the user reviews and signs it in their own wallet. Off by default. When enabled:
                  the assistant only carries out what a user explicitly requests and never
                  recommends trades; every transaction is signed by the user; approvals are
                  exact-amount only; wallets are screened against the OFAC sanctions list; the
                  feature is geo-restricted in sanctioned regions; and TxID takes no fee on any
                  transaction. For projects that don&apos;t enable Actions, the assistant remains
                  fully read-only.
                </p>
              </div>
            </FadeIn>
          </div>

          {/* Data handling */}
          <div className="mt-16">
            <FadeIn>
              <div className="mb-4">
                <h2 className="font-display text-xl font-semibold text-white">Your data</h2>
                <p className="text-sm text-muted mt-1 max-w-2xl">
                  The short version: it reads what a block explorer can, stores as
                  little as it needs, and never handles anything secret.
                </p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DATA.map((item, i) => (
                <FadeIn key={item.title} delay={(i % 3) * 0.06}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 h-full">
                    <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center mb-3">
                      <item.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                    </div>
                    <h3 className="font-display font-semibold text-white text-sm mb-1.5">{item.title}</h3>
                    <p className="text-xs text-muted leading-relaxed">{item.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* No integration required */}
          <div className="mt-16">
            <FadeIn>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-8">
                <h2 className="font-display text-xl font-semibold text-white mb-2">Nothing to integrate</h2>
                <p className="text-sm text-muted leading-relaxed max-w-3xl">
                  TxID reads your users&apos; activity the same way a block explorer does: through public
                  RPC endpoints and explorer APIs. It does <span className="text-white">not</span> integrate
                  with your smart contracts, is never granted any permission or access to them, and deploys
                  nothing on-chain. There is no contract to connect and no access to approve. Adding TxID
                  changes nothing about your contracts or their permissions, because it only ever
                  <span className="text-white"> reads public data anyone can already see</span>.
                </p>
              </div>
            </FadeIn>
          </div>

          {/* Closing CTA */}
          <FadeIn>
            <div className="mt-16 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
              <h2 className="font-display text-2xl font-bold text-white mb-2">
                Something your reviewer needs?
              </h2>
              <p className="text-muted max-w-lg mx-auto mb-6">
                Send this page to your security or compliance team. For a data
                processing agreement, a specific question, or anything not covered
                here, we&apos;re one email away.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button href="/contact" variant="primary" size="lg">
                  Talk to us
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href={`${APP_URL}/sign-up`} variant="outline" size="lg">
                  Get started free
                </Button>
              </div>
              <p className="text-xs text-muted/60 mt-5">
                See also our{" "}
                <Link href="/privacy" className="text-muted hover:text-white underline underline-offset-2">privacy policy</Link>{" "}
                and{" "}
                <Link href="/terms" className="text-muted hover:text-white underline underline-offset-2">terms</Link>.
              </p>
            </div>
          </FadeIn>
        </div>
      </main>
      <Footer />
    </>
  );
}
