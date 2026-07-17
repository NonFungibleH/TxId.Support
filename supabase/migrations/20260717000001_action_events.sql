-- Audit trail for the "Actions" feature (AI-prepared, user-signed transactions).
-- Two record kinds share the table:
--   kind = 'ack'                        → user acknowledged the Actions modal
--                                         (action_id NULL, status 'acknowledged')
--   kind = 'contract_action' | 'swap'   → a prepared action and its lifecycle
--                                         (never 'acknowledged'; 'expired' is
--                                         written only by the rebuild endpoint)
-- Service-role access only; not surfaced in any dashboard in v1.

create table if not exists action_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  session_id text not null,
  action_id uuid,
  kind text not null check (kind in ('ack', 'contract_action', 'swap')),
  chain text,
  summary text,
  params jsonb,
  status text not null check (status in ('acknowledged', 'prepared', 'rebuilt', 'confirmed', 'failed', 'expired')),
  country text,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_events_project_idx on action_events(project_id, created_at desc);
create unique index if not exists action_events_action_idx on action_events(action_id) where action_id is not null;

alter table action_events enable row level security;
-- No policies: service-role only.
