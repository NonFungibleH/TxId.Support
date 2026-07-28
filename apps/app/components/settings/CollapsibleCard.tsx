"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface CollapsibleCardProps {
  title: string
  description?: ReactNode
  /** Shown in the header only while collapsed — e.g. the current value / status. */
  summary?: ReactNode
  /** Right-aligned control (e.g. an Add button). Sits outside the toggle, so clicks don't collapse. */
  action?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

// Accordion-style section: a Card whose header toggles its body. Used on the
// Smart Contracts page so the large Token section can be collapsed away from
// the Watched-contracts section — the two were easy to confuse when both were
// expanded and a user could paste a watched-contract address into the token box.
export function CollapsibleCard({ title, description, summary, action, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start gap-2 px-4 py-4">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
              open ? "" : "-rotate-90"
            )}
          />
          <div className="grid gap-1">
            <span className="font-heading text-base leading-snug font-medium">{title}</span>
            {description && <span className="text-sm text-muted-foreground">{description}</span>}
            {!open && summary && <span className="text-sm text-muted-foreground pt-0.5">{summary}</span>}
          </div>
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  )
}
