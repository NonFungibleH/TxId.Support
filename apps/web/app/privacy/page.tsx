import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy | TxID Support",
  alternates: { canonical: "/privacy" },
};

const LAST_UPDATED = "June 2025";

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-6">
          <p className="font-mono text-sm text-accent mb-3">{"Legal"}</p>
          <h1 className="font-display text-4xl font-bold text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted mb-12">Last updated: {LAST_UPDATED}</p>

          <div className="prose prose-sm prose-invert max-w-none space-y-8 text-muted leading-relaxed">

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">What we collect</h2>
              <p>When you use TxID Support, we collect:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong className="text-white/80">Account data:</strong> your email address and name, via Clerk authentication</li>
                <li><strong className="text-white/80">Project configuration:</strong> branding settings, smart contract addresses, and documentation you index</li>
                <li><strong className="text-white/80">Agent conversations:</strong> messages sent by your end-users to the agent, stored to power analytics and improve the AI</li>
                <li><strong className="text-white/80">Usage data:</strong> conversation counts, timestamps, and satisfaction ratings</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">Wallet addresses</h2>
              <p>
                The agent reads the public wallet address of connected wallets to provide personalised support. We store wallet addresses only as part of conversation records. We never request private keys, seed phrases, or signing permission beyond what the user&apos;s own site already has.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">How we use your data</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To provide and improve the Service</li>
                <li>To generate analytics visible in your dashboard</li>
                <li>To train and fine-tune AI models (conversation data only, anonymised)</li>
                <li>To send important Service updates (no marketing without consent)</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">Third parties</h2>
              <p>We use the following sub-processors:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong className="text-white/80">Anthropic:</strong> AI inference (Claude)</li>
                <li><strong className="text-white/80">Voyage AI:</strong> document embeddings</li>
                <li><strong className="text-white/80">Supabase:</strong> database and storage</li>
                <li><strong className="text-white/80">Clerk:</strong> authentication</li>
                <li><strong className="text-white/80">Moralis:</strong> on-chain data</li>
                <li><strong className="text-white/80">Vercel:</strong> hosting</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">Data retention</h2>
              <p>
                Conversation data is retained for 12 months. You can request deletion of your account and associated data at any time by emailing us.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">Your rights</h2>
              <p>
                You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at{" "}
                <a href="mailto:hello@txid.support" className="text-accent hover:underline">
                  hello@txid.support
                </a>
              </p>
            </section>

            <section id="cookies">
              <h2 className="font-display text-lg font-semibold text-white mb-3">Cookies</h2>
              <p className="mb-3">
                We use only essential cookies: those strictly necessary to operate the service. We do not use advertising, tracking, or analytics cookies.
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong className="text-white/80">Authentication cookies:</strong> set by Clerk to keep you signed in to the dashboard. These expire when you sign out or after 30 days of inactivity.
                </li>
                <li>
                  <strong className="text-white/80">Session preference:</strong> a single <code className="text-xs bg-white/10 px-1 rounded">localStorage</code> entry records that you have acknowledged this notice. It contains no personal data and is stored in your browser only.
                </li>
              </ul>
              <p className="mt-3">
                The support agent uses <code className="text-xs bg-white/10 px-1 rounded">sessionStorage</code> (not cookies) to hold the active conversation. This is cleared automatically when the browser tab is closed and is never sent to our servers except as part of a conversation message.
              </p>
              <p className="mt-3">
                Because we use only essential cookies, no consent is required under UK/EU law, but we show a notice as good practice. You can clear cookies at any time through your browser settings; this will sign you out of the dashboard.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">Changes</h2>
              <p>
                We may update this policy. We&apos;ll notify registered users of material changes by email.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
