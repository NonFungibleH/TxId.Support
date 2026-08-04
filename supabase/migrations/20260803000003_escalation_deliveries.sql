-- Escalation delivery, with somewhere for failures to go.
--
-- WHY: dispatch was fire-and-forget. One 5s timeout, allSettled, a log line,
-- and gone. If Slack blips, that escalation is lost: the user was told a human
-- would follow up, and no human ever hears. For a support product that is the
-- worst failure mode there is, and it is silent.
--
-- Failed deliveries land here with the payload they need to be retried, so a
-- retry is a real redelivery rather than a guess at what was meant to be sent.

create table if not exists escalation_deliveries (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  target         text not null,
  ticket_ref     text not null,
  -- Everything needed to send it again without reconstructing the ticket.
  payload        jsonb not null,
  status         text not null default 'pending' check (status in ('pending', 'delivered', 'abandoned')),
  attempts       integer not null default 1,
  last_error     text,
  -- Exponential backoff: the earliest a retry should be attempted.
  next_attempt_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table escalation_deliveries is
  'Escalations that failed to reach their destination, with the payload needed to redeliver. A row here means a user was promised a follow-up that has not been delivered.';

-- The retry worker asks one question: what is due now?
create index if not exists escalation_deliveries_due_idx
  on escalation_deliveries (next_attempt_at)
  where status = 'pending';

create index if not exists escalation_deliveries_project_idx
  on escalation_deliveries (project_id, created_at desc);

alter table escalation_deliveries enable row level security;
