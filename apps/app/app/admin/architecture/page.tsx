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
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Admin console
          </Link>
          <h1 className="text-3xl font-bold">How the system fits together</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Every layer, in the order a question travels through it. Written as data next to the
            code rather than drawn, so it changes when the system does and anything stale shows up
            as a diff rather than as a surprise in front of a partner.
          </p>
        </div>

        <ArchitectureMap />
      </div>
    </div>
  )
}
