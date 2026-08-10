import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LEGAL_ENTITY, LEGAL_ENTITY_FULL, PRODUCT, LEGAL_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | TxID",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "August 2026";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-6">
          <p className="font-mono text-sm text-accent mb-3">{"Legal"}</p>
          <h1 className="font-display text-4xl font-bold text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted mb-12">Last updated: {LAST_UPDATED}</p>

          <div className="prose prose-sm prose-invert max-w-none space-y-8 text-muted leading-relaxed">

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">1. Who you are contracting with</h2>
              <p>
                {PRODUCT} is a product operated by {LEGAL_ENTITY_FULL}. In these Terms, &ldquo;{LEGAL_ENTITY}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; mean {LEGAL_ENTITY}, and &ldquo;the Service&rdquo; means {PRODUCT}. {LEGAL_ENTITY} is the contracting party for every right and obligation set out below.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">2. Acceptance</h2>
              <p>
                By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">3. Service status</h2>
              <p>
                The Service is provided &ldquo;as is&rdquo; and features may change without notice. Unless we have agreed a written service level with you, we make no guarantee of uptime or availability.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">4. Acceptable use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Use the Service for unlawful purposes</li>
                <li>Attempt to reverse-engineer or circumvent rate limits</li>
                <li>Use the Service to spread misinformation or conduct fraud</li>
                <li>Resell or sublicense access without written permission</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">5. Your data</h2>
              <p>
                You retain ownership of any content (documentation, configuration) you provide to the Service. By submitting content, you grant {LEGAL_ENTITY} a limited licence to process it solely for the purpose of providing the Service. How that content is handled is set out in our{" "}
                <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">6. AI outputs</h2>
              <p>
                The Service uses large language models (Claude by Anthropic) to generate responses. AI outputs may occasionally be incorrect. You are responsible for verifying critical information before acting on it. {LEGAL_ENTITY} is not liable for losses arising from AI-generated content.
              </p>
              <p className="mt-3">
                The Service does not provide financial, investment, tax or legal advice, and nothing it produces should be treated as any of those.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">7. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, {LEGAL_ENTITY} shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">8. Changes</h2>
              <p>
                We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-white mb-3">9. Contact</h2>
              <p>
                These Terms are between you and {LEGAL_ENTITY}. Questions? Email us at{" "}
                <a href={`mailto:${LEGAL_CONTACT}`} className="text-accent hover:underline">
                  {LEGAL_CONTACT}
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
