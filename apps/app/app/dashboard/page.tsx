import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Users, Zap, Globe, ArrowRight } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function DashboardPage() {
  const { project } = await getProject()

  if (!project) {
    redirect("/onboarding")
  }

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()

  const [convResult, docsResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
  ])

  const config = typedProject.config as unknown as ProjectConfig

  const QUICK_LINKS = [
    { href: "/dashboard/branding",  label: "Configure branding",  desc: "Colors, fonts, widget position" },
    { href: "/dashboard/token",     label: "Add your token",      desc: "Address, chain, DEX link" },
    { href: "/dashboard/contracts", label: "Watched contracts",   desc: "Smart contracts for AI lookup" },
    { href: "/dashboard/docs",      label: "Upload docs",         desc: "Feed the AI knowledge base" },
    { href: "/dashboard/embed",     label: "Get embed code",      desc: "Drop the widget in minutes" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{typedProject.name}</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono text-xs">
            {typedProject.publishable_key}
          </p>
        </div>
        <Badge variant={typedProject.is_active ? "default" : "secondary"}>
          {typedProject.is_active ? "Live" : "Paused"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard title="Conversations" value={convResult.count ?? 0} description="All time" icon={MessageSquare} />
        <StatsCard title="Users helped" value={convResult.count ?? 0} description="Unique sessions" icon={Users} />
        <StatsCard title="Knowledge docs" value={docsResult.count ?? 0} description="Indexed chunks" icon={Globe} />
        <StatsCard title="Chains enabled" value={config.chains.length} description="of 6 supported" icon={Zap} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick setup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {QUICK_LINKS.map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm hover:bg-accent/50 transition-colors"
            >
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

