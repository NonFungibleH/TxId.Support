"use client"

import { Download } from "lucide-react"

/**
 * Hands the agent the case record as a file: the artefact a compliance team
 * actually attaches to a dispute. The export itself is a disclosure, so on the
 * authenticated console it is logged like any other access.
 */
export function ExportCaseButton({
  filename, payload, caseId, audit,
}: { filename: string; payload: unknown; caseId: string; audit: boolean }) {
  function download() {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    if (audit) {
      fetch("/api/console/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "export", entity: `case:${caseId}` }),
      }).catch(() => { /* the export already happened; logging is best-effort */ })
    }
  }
  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-foreground hover:border-primary/50 transition-colors"
    >
      <Download className="h-3.5 w-3.5" /> Export case record
    </button>
  )
}
