import { notFound } from "next/navigation"
import Link from "next/link"
import { isCurrentUserAdmin } from "@/lib/admin-auth"
import { listDemos } from "@/lib/actions/demos"
import { DemosManager } from "@/components/admin/DemosManager"

export default async function DemosPage() {
  if (!(await isCurrentUserAdmin())) return notFound()

  const demos = await listDemos()

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Internal — sales demos</p>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Demo Creator</h1>
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← Admin</Link>
        </div>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Pre-build a themed demo per prospect. Drag its bookmarklet to your toolbar, then click it on their live site to pop the widget on during a call. Share the link so they can try it on their own site afterwards, no account needed.
        </p>
      </div>
      <DemosManager initial={demos} />
    </div>
  )
}
