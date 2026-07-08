import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { ForWho } from "@/components/sections/ForWho";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { EmbedPreview } from "@/components/sections/EmbedPreview";
import { ComplianceSection } from "@/components/sections/ComplianceSection";
import { PlatformTeaser } from "@/components/sections/PlatformTeaser";
import { PricingSection } from "@/components/sections/PricingSection";
import { FAQ, FAQS } from "@/components/sections/FAQ";
import { ClosingCTA } from "@/components/sections/ClosingCTA";
import { JsonLd } from "@/components/JsonLd";
import { organizationSchema, websiteSchema, softwareApplicationSchema, faqPageSchema, howToEmbedSchema } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd data={howToEmbedSchema} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <Navbar />
      <main>
        <Hero />
        <ForWho />
        <HowItWorks />
        <FeatureGrid />
        <EmbedPreview />
        <ComplianceSection />
        <PlatformTeaser />
        <PricingSection compact />
        <FAQ />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
