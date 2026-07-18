import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { isCurrentUserAdmin } from "@/lib/admin-auth"
import { RoadmapBoard } from "@/components/admin/RoadmapBoard"

export default async function RoadmapPage() {
  // Auth guard — only configured admin emails (mirrors /admin).
  if (!(await isCurrentUserAdmin())) {
    return notFound()
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="size-3.5" /> Admin console
          </Link>
          <h1 className="text-3xl font-bold">Product roadmap</h1>
          <p className="text-muted-foreground mt-1">
            Prioritised plan for what we build next. Set statuses and jot notes as you go.
          </p>
        </div>
        <RoadmapBoard />
      </div>
    </div>
  )
}
