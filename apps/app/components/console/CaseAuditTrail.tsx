import type { CaseView } from "@/lib/console/types"

/**
 * The compliance trail, made visible on the case itself.
 *
 * Three kinds of time, deliberately kept apart, because an audit falls apart
 * the moment one timestamp column tries to do three jobs:
 *  - CHAIN time: when the event was true on-chain. Not our clock, consensus's,
 *    so an auditor can verify it without trusting us.
 *  - OBSERVATION time: when TxID read the chain and produced the answer.
 *  - ACTION time: who viewed, copied or forwarded it, and when.
 */
const utc = (iso: string) => new Date(iso).toISOString().replace("T", " ").replace(".000Z", " UTC")

export function CaseAuditTrail({ view, replySha }: { view: CaseView; replySha: string }) {
  const r = view.resolution
  if (!r) return null
  const anchors = r.evidence.filter(e => /ledger|block/i.test(e.label))

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Audit trail</p>
      </div>
      <div className="space-y-4 px-4 py-4 text-xs">
        <div>
          <p className="mb-1 font-medium text-foreground">Chain time</p>
          {anchors.map(a => (
            <p key={a.label} className="text-muted-foreground">
              {a.label}: <span className="font-mono text-foreground">{a.value}</span>
            </p>
          ))}
          {view.occurredAt ? (
            <p className="text-muted-foreground">Event occurred {utc(view.occurredAt)}</p>
          ) : (
            <p className="text-muted-foreground">Block time not recorded; the height above is the anchor.</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            Anchored to the chain itself, so it is verifiable without trusting us.
          </p>
        </div>

        <div className="border-t pt-3">
          <p className="mb-1 font-medium text-foreground">Observation</p>
          <p className="text-muted-foreground">Diagnosed {utc(r.diagnosedAt)}</p>
          <p className="text-muted-foreground break-all">
            Reply SHA-256: <span className="font-mono">{replySha.slice(0, 16)}…</span>
          </p>
        </div>

        <div className="border-t pt-3">
          <p className="mb-1 font-medium text-foreground">Actions</p>
          {r.trail.length === 0 && (
            <p className="text-muted-foreground">No actions recorded yet. Viewing this page is the first.</p>
          )}
          <ul className="space-y-1.5">
            {r.trail.map(t => (
              <li key={`${t.at}-${t.event}`} className="text-muted-foreground">
                <span className="font-mono text-[11px]">{utc(t.at)}</span>
                <span className="block text-foreground">{t.event}</span>
                <span className="text-[11px]">{t.actor}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t px-4 py-2.5">
        <p className="text-[11px] text-muted-foreground">
          Timestamps are server-set, UTC. The record is append-only: it can be added to, never rewritten.
        </p>
      </div>
    </div>
  )
}
