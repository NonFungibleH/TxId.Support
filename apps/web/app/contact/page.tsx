import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContactCard } from "@/components/sections/ContactCard";

export const metadata: Metadata = {
  title: "Contact | TxID Support",
  description: "Get in touch with the TxID Support team by email or Telegram.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-6">
          <p className="font-mono text-sm text-accent mb-3">Contact</p>
          <h1 className="font-display text-4xl font-bold text-white mb-2">
            Get in touch
          </h1>
          <p className="text-sm text-muted mb-10">
            Questions, a demo, or moving to a paid plan? Reach us however suits you.
          </p>

          <ContactCard />
        </div>
      </main>
      <Footer />
    </>
  );
}
