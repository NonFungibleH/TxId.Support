import { UserButton } from "@clerk/nextjs"
import { Menu } from "lucide-react"

interface DashboardHeaderProps {
  orgName: string
  onMenuToggle?: () => void
}

export function DashboardHeader({ orgName, onMenuToggle }: DashboardHeaderProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:left-60 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors md:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="size-5" />
        </button>
        <p className="text-sm font-medium text-foreground">{orgName}</p>
      </div>
      <UserButton afterSignOutUrl="/sign-in" />
    </header>
  )
}
