/**
 * Shown the instant a dashboard tab is clicked, while the page's server render
 * (auth + several Supabase reads) is still in flight.
 *
 * WHY: without this file, App Router keeps the OLD page on screen until the
 * new one's data arrives, so a tab click looked like nothing happened for up
 * to a second and the dashboard read as slow. The queries still take the time
 * they take; this makes the click acknowledge itself immediately, which is
 * most of what "fast" means in navigation.
 *
 * One file at the dashboard segment covers every tab, because switching
 * sibling routes suspends the segment below the shared layout.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded-md bg-muted/60" />
      </div>
      <div className="h-40 rounded-xl border border-border bg-muted/30" />
      <div className="h-64 rounded-xl border border-border bg-muted/30" />
    </div>
  )
}
