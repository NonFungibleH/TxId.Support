import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { isCurrentUserAdmin } from "@/lib/admin-auth"
import { ArchitectureMap } from "@/components/admin/ArchitectureMap"

export default async function ArchitecturePage() {
  // Auth guard - only configured admin emails (mirrors /admin).
  if (!(await isCurrentUserAdmin())) {
    return notFound()
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Admin console
        </Link>

        <ArchitectureMap />
      </div>
    </div>
  )
}
