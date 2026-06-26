"use client"

import { Bookmark } from "lucide-react"

interface BookmarkletButtonProps {
  href: string
}

/**
 * Draggable bookmarklet anchor — must be a client component because it
 * carries an onClick handler (which cannot exist in a Server Component).
 */
export function BookmarkletButton({ href }: BookmarkletButtonProps) {
  return (
    // eslint-disable-next-line react/jsx-no-script-url
    <a
      href={href}
      onClick={e => e.preventDefault()}
      draggable
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground cursor-grab active:cursor-grabbing select-none"
      title="Drag this to your bookmarks bar"
    >
      <Bookmark className="size-4" />
      TxID Preview
    </a>
  )
}
