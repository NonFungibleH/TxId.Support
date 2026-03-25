import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { EmbedPreview } from "@/components/sections/EmbedPreview";
import { PricingSection } from "@/components/sections/PricingSection";
import { LogosBar } from "@/components/sections/LogosBar";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LogosBar />
        <HowItWorks />
        <FeatureGrid />
        <EmbedPreview />
        <PricingSection compact />
      </main>
      <Footer />
    </>
  );
}
