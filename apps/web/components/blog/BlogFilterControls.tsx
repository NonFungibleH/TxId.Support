"use client"

import { useRouter, useSearchParams } from "next/navigation"

interface Props {
  allTags: string[]
  activeTag: string
  activeSort: string
}

export function BlogFilterControls({ allTags, activeTag, activeSort }: Props) {
  const router = useRouter()
  useSearchParams()

  function navigate(tag: string, sort: string) {
    const params = new URLSearchParams()
    if (tag && tag !== "all") params.set("tag", tag)
    if (sort && sort !== "newest") params.set("sort", sort)
    const qs = params.toString()
    router.push(`/blog${qs ? `?${qs}` : ""}`)
  }

  function handleTagClick(tag: string) {
    navigate(tag, activeSort)
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    navigate(activeTag, e.target.value)
  }

  const chips = ["all", ...allTags]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs text-muted mb-3 uppercase tracking-wider">Filter by topic</p>
        <div className="flex flex-wrap gap-2">
          {chips.map((tag) => {
            const isActive = tag === activeTag
            return (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={
                  isActive
                    ? "px-3 py-1 rounded-full text-xs font-mono font-semibold bg-accent text-white transition-colors"
                    : "px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[var(--bg-surface)] text-muted border border-[var(--border)] hover:border-accent/50 transition-colors"
                }
              >
                {tag === "all" ? "All" : tag}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="font-mono text-xs text-muted mb-2 uppercase tracking-wider">Sort</p>
        <select
          value={activeSort}
          onChange={handleSortChange}
          className="w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--bg-surface)] text-muted border border-[var(--border)] focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="quickest">Quickest read</option>
        </select>
      </div>
    </div>
  )
}
