import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";

export const metadata: Metadata = {
  title: "Blog — TxID Support",
};

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center pt-24">
        <FadeIn className="text-center px-6">
          <p className="font-mono text-sm text-accent mb-3">{"// Blog"}</p>
          <h1 className="font-display text-4xl font-bold text-white mb-4">
            Coming soon
          </h1>
          <p className="text-muted">
            Guides, updates, and deep-dives on Web3 support.
          </p>
        </FadeIn>
      </main>
      <Footer />
    </>
  );
}
