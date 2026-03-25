import { UserButton } from "@clerk/nextjs"

export function DashboardHeader({ orgName }: { orgName: string }) {
  return (
    <header className="fixed inset-x-0 left-60 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <p className="text-sm font-medium text-foreground">{orgName}</p>
      <UserButton afterSignOutUrl="/sign-in" />
    </header>
  )
}
