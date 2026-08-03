-- Compliance evidence for each answer.
--
-- The case record already holds the question, the answer and the investigation.
-- What a reviewer asks next is "under what conditions was this said, and can I
-- reproduce it?". That needs the state the answer rested on, not just its text.
--
-- Deliberately NOT stored: raw IP addresses. Country is derived at the edge and
-- the IP is discarded, because an IP is personal data under GDPR and would drag
-- retention and subject-access obligations onto a field only ever needed at
-- country granularity. Nothing here fingerprints a device beyond the coarse
-- platform the browser already announces.

alter table messages
  add column if not exists evidence jsonb;

comment on column messages.evidence is
  'Conditions an assistant answer was produced under: chain state (ledger version), request context (country, coarse device, surface, language), model and prompt version, tool calls and any failed lookups, latency, and a hash of the answer. No IP addresses, no device fingerprinting.';

-- Reviewing a case pulls the evidence for one conversation at a time, and the
-- column is null on user rows, so keep the index to rows that have one.
create index if not exists messages_evidence_idx
  on messages using gin (evidence)
  where evidence is not null;
