-- Webhook delivery log — records every outbound webhook attempt for a ticket
create table if not exists public.webhook_logs (
  id            uuid         primary key default gen_random_uuid(),
  project_id    uuid         not null references public.projects(id) on delete cascade,
  ticket_ref    text         not null,
  webhook_url   text         not null,
  status_code   int,
  success       boolean      not null default false,
  error_message text,
  duration_ms   int,
  fired_at      timestamptz  not null default now()
);

create index if not exists webhook_logs_project_id_idx on public.webhook_logs(project_id);
create index if not exists webhook_logs_fired_at_idx   on public.webhook_logs(fired_at desc);

-- Service-role only (same pattern as tickets)
alter table public.webhook_logs enable row level security;

create policy "Service role full access on webhook_logs"
  on public.webhook_logs
  for all
  to service_role
  using (true)
  with check (true);
