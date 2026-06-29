import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PlatformWidget } from "@/components/shared/PlatformWidget";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TxID Support — Dashboard",
  description: "Configure your TxID Support widget",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/onboarding"
      appearance={{
        variables: {
          colorPrimary: "#6366f1",
          colorBackground: "#1a1b2e",
          colorInputBackground: "#0f1021",
          colorInputText: "#f4f4f5",
          colorText: "#f4f4f5",
          colorTextSecondary: "#a1a1aa",
          colorDanger: "#ef4444",
          borderRadius: "0.75rem",
          fontFamily: "Inter, sans-serif",
        },
        elements: {
          card: "shadow-2xl border border-indigo-900/40",
          navbar: "border-r border-indigo-900/40",
          navbarButton: "text-zinc-300 hover:text-zinc-50 hover:bg-white/5",
          navbarButtonActive: "bg-indigo-500/10 text-indigo-400",
          headerTitle: "text-zinc-50",
          headerSubtitle: "text-zinc-400",
          formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 shadow-none",
          formFieldInput: "border-indigo-900/50 text-zinc-50 placeholder:text-zinc-600",
          formFieldLabel: "text-zinc-300",
          dividerLine: "bg-indigo-900/40",
          dividerText: "text-zinc-500",
          socialButtonsBlockButton: "border-indigo-900/40 text-zinc-100 hover:bg-white/5",
          badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          // Popover: needs visible contrast against the dark dashboard
          userButtonPopoverCard: "shadow-2xl border border-indigo-900/40 bg-[#1a1b2e]",
          userButtonPopoverActionButton: "hover:bg-white/5 text-zinc-200",
          userButtonPopoverActionButtonText: "text-zinc-200",
          userButtonPopoverActionButtonIcon: "text-zinc-400",
          userButtonPopoverFooter: "hidden",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={inter.className}>
          {children}
          <Toaster />
          <PlatformWidget />
        </body>
      </html>
    </ClerkProvider>
  );
}
