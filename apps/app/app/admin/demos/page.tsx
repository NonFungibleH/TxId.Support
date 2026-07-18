import { currentUser } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { listDemos } from "@/lib/actions/demos"
import { DemosManager } from "@/components/admin/DemosManager"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map(e => e.trim()).filter(Boolean)

export default async function DemosPage() {
  const user = await currentUser()
  const email = user?.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase()
  if (!email || (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email))) return notFound()

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
