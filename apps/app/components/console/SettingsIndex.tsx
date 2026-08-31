import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { FileCode2, Users, Plug, Eye, ArrowRight } from "lucide-react"

/**
 * Setup lives behind one Settings entry, the way every CRM a support team
 * already uses does it. The daily nav is for daily work; the onboarding
 * checklist on Overview is what walks a new workspace through these in order.
 */
export function SettingsIndex({ base }: { base: string }) {
  const SECTIONS = [
    { href: `${base}/settings/contracts`, icon: FileCode2, label: "Smart Contracts", detail: "Which contracts are yours. Everything the Console shows is scoped to these, and the list is shared with the support product." },
    { href: `${base}/settings/identity`, icon: Users, label: "Customer identity", detail: "How an email address becomes a wallet. The step every search depends on." },
    { href: `${base}/settings/crm`, icon: Plug, label: "CRM", detail: "Answers written onto the ticket your team already has open, and the wallet read back the other way." },
    { href: `${base}/settings/verify`, icon: Eye, label: "Check it works", detail: "Look up one real customer and confirm the answer is right before your team depends on it." },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">How the Console is wired up.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ href, icon: Icon, label, detail }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="pt-6">
                <Icon className="mb-3 size-4 text-muted-foreground" />
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {label}
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Team and access are shared across products and live under{" "}
        <Link href="/dashboard/team" className="text-primary hover:underline">Team &amp; access</Link>.
      </p>
    </div>
  )
}
