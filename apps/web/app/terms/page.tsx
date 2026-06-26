import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — TxID Support",
};

const LAST_UPDATED = "April 2025";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-6">
          <p className="font-mono text-sm text-accent mb-3">{"// Legal"}</p>
          <h1 className="font-display text-4xl font-bold text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted mb-12">Last updated: {LAST_UPDATED}</p>

          <div className="prose prose-sm prose-invert max-w-none space-y-8 text-muted leading-relaxed">

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">1. Acceptance</h2>
              <p>
                By accessing or using TxID Support (&ldquo;the Service&rdquo;), you agree to be bound by these Terms. If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">2. Beta status</h2>
              <p>
                TxID Support is currently in beta. The Service is provided &ldquo;as is&rdquo; and features may change without notice. We make no guarantees of uptime or availability during the beta period.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">3. Acceptable use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Use the Service for unlawful purposes</li>
                <li>Attempt to reverse-engineer or circumvent rate limits</li>
                <li>Use the Service to spread misinformation or conduct fraud</li>
                <li>Resell or sublicense access without written permission</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">4. Your data</h2>
              <p>
                You retain ownership of any content (documentation, configuration) you provide to the Service. By submitting content, you grant TxID Support a limited licence to process it solely for the purpose of providing the Service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">5. AI outputs</h2>
              <p>
                TxID Support uses large language models (Claude by Anthropic) to generate responses. AI outputs may occasionally be incorrect. You are responsible for verifying critical information before acting on it. TxID Support is not liable for losses arising from AI-generated content.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">6. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, TxID Support shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">7. Changes</h2>
              <p>
                We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">8. Contact</h2>
              <p>
                Questions? Email us at{" "}
                <a href="mailto:hello@txid.support" className="text-accent hover:underline">
                  hello@txid.support
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
