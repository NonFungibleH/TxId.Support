import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PlatformWidget } from "@/components/shared/PlatformWidget";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { ThemedClerkProvider } from "@/components/shared/ThemedClerkProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TxID Support — Dashboard",
  description: "Configure your TxID Support widget",
  // Icons come from the file-based convention (app/icon.png, app/apple-icon.png,
  // app/favicon.ico) — same as the marketing site.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <ThemedClerkProvider>
            {children}
            <Toaster />
            <PlatformWidget />
          </ThemedClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
