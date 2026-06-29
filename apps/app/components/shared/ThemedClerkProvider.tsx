"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { useTheme } from "next-themes"

const BASE = {
  colorPrimary: "#6366f1",
  colorDanger: "#ef4444",
  borderRadius: "0.75rem",
  fontFamily: "Inter, sans-serif",
}

const DARK_APPEARANCE = {
  variables: {
    ...BASE,
    colorBackground: "#1a1b2e",
    colorInputBackground: "#0f1021",
    colorInputText: "#f4f4f5",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
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
    userButtonPopoverCard: "shadow-2xl border border-indigo-900/40 bg-[#1a1b2e]",
    userButtonPopoverActionButton: "hover:bg-white/10 text-zinc-200 hover:text-white",
    userButtonPopoverActionButtonText: "text-zinc-200 hover:text-white",
    userButtonPopoverActionButtonIcon: "text-zinc-400",
    userButtonPopoverFooter: "hidden",
  },
}

const LIGHT_APPEARANCE = {
  variables: {
    ...BASE,
    colorBackground: "#ffffff",
    colorInputBackground: "#f9fafb",
    colorInputText: "#111827",
    colorText: "#111827",
    colorTextSecondary: "#6b7280",
  },
  elements: {
    card: "shadow-lg border border-gray-200",
    navbar: "border-r border-gray-100",
    navbarButton: "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
    navbarButtonActive: "bg-indigo-50 text-indigo-600",
    headerTitle: "text-gray-900",
    headerSubtitle: "text-gray-500",
    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 shadow-none text-white",
    formFieldInput: "border-gray-200 text-gray-900 placeholder:text-gray-400",
    formFieldLabel: "text-gray-700",
    dividerLine: "bg-gray-100",
    dividerText: "text-gray-400",
    socialButtonsBlockButton: "border-gray-200 text-gray-700 hover:bg-gray-50",
    badge: "bg-indigo-50 text-indigo-600 border-indigo-200",
    userButtonPopoverCard: "shadow-lg border border-gray-200 bg-white",
    userButtonPopoverActionButton: "hover:bg-gray-50 text-gray-700 hover:text-gray-900",
    userButtonPopoverActionButtonText: "text-gray-700 hover:text-gray-900",
    userButtonPopoverActionButtonIcon: "text-gray-400",
    userButtonPopoverFooter: "hidden",
  },
}

export function ThemedClerkProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme()
  return (
    <ClerkProvider
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/onboarding"
      appearance={resolvedTheme === "light" ? LIGHT_APPEARANCE : DARK_APPEARANCE}
    >
      {children}
    </ClerkProvider>
  )
}
