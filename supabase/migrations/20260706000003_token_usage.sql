-- Per-turn LLM token usage, for the admin cost cockpit. One row per assistant
-- turn. project_id is denormalised so per-customer totals are a cheap group-by
-- (no join through conversations). The token counts come free in the Anthropic
-- API response — we just persist them.

create table if not exists public.token_usage (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references public.projects(id) on delete cascade,
  conversation_id uuid        references public.conversations(id) on delete set null,
  model           text        not null,
  input_tokens    integer     not null default 0,
  output_tokens   integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists token_usage_project_id_idx on public.token_usage(project_id);
create index if not exists token_usage_created_at_idx  on public.token_usage(created_at desc);

-- Per-project token totals (all-time + current UTC month) for the admin table.
create or replace function admin_token_usage()
returns table (
  project_id     uuid,
  input_all      bigint,
  output_all     bigint,
  input_month    bigint,
  output_month   bigint
)
language sql
security definer
stable
as $$
  select
    project_id,
    coalesce(sum(input_tokens), 0)  as input_all,
    coalesce(sum(output_tokens), 0) as output_all,
    coalesce(sum(input_tokens)  filter (where created_at >= date_trunc('month', now() at time zone 'utc')), 0) as input_month,
    coalesce(sum(output_tokens) filter (where created_at >= date_trunc('month', now() at time zone 'utc')), 0) as output_month
  from token_usage
  group by project_id
$$;
