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
          colorBackground: "#09090b",
          colorInputBackground: "#18181b",
          colorInputText: "#f4f4f5",
          colorText: "#f4f4f5",
          colorTextSecondary: "#71717a",
          colorDanger: "#ef4444",
          borderRadius: "0.75rem",
          fontFamily: "Inter, sans-serif",
        },
        elements: {
          card: "shadow-2xl border border-zinc-800 bg-zinc-950",
          navbar: "border-r border-zinc-800 bg-zinc-950",
          navbarButton: "text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800",
          navbarButtonActive: "bg-indigo-500/10 text-indigo-400",
          headerTitle: "text-zinc-50",
          headerSubtitle: "text-zinc-400",
          formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 shadow-none",
          formFieldInput: "bg-zinc-900 border-zinc-700 text-zinc-50 placeholder:text-zinc-600",
          formFieldLabel: "text-zinc-300",
          dividerLine: "bg-zinc-800",
          dividerText: "text-zinc-500 bg-zinc-950",
          socialButtonsBlockButton: "bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800",
          badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          avatarBox: "ring-2 ring-indigo-500/20",
          userButtonPopoverCard: "shadow-2xl border border-zinc-800 bg-zinc-950",
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
