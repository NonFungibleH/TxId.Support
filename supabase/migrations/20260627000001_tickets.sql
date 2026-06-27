-- Support ticket table
create table if not exists public.tickets (
  id          uuid         primary key default gen_random_uuid(),
  project_id  uuid         not null references public.projects(id) on delete cascade,
  ref         text         not null,
  user_name   text,
  user_email  text,
  summary     text         not null,
  reason      text,
  conversation jsonb,
  status      text         not null default 'open',
  notes       text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists tickets_project_id_idx on public.tickets(project_id);
create index if not exists tickets_created_at_idx  on public.tickets(created_at desc);

-- Row-level security (service role only — dashboard and widget both use service key)
alter table public.tickets enable row level security;

create policy "Service role full access on tickets"
  on public.tickets
  for all
  to service_role
  using (true)
  with check (true);
