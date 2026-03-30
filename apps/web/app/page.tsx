import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { EmbedPreview } from "@/components/sections/EmbedPreview";
import { PricingSection } from "@/components/sections/PricingSection";
export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <EmbedPreview />
        <PricingSection compact />
      </main>
      <Footer />
    </>
  );
}
