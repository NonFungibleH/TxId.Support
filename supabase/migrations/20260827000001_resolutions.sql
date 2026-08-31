-- Structured, queryable record of every resolution TxID produces.
--
-- WHY THIS EXISTS: /api/v1/resolve computed a resolution, logged a line, and
-- returned it. Nothing was kept. So "what are this protocol's most common
-- failures this week" was unanswerable, the Console had no cases to show, and
-- a spike in one abort code was invisible.
--
-- TYPED COLUMNS, NOT JSONB, for everything you group by. The entire value of
-- this table is aggregation, and you cannot index or GROUP BY inside jsonb
-- cheaply at volume. `evidence` stays jsonb because it is read per row, never
-- aggregated.

create table if not exists resolutions (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable + `on delete set null`, matching case_access_log: a record of an
  -- answer we gave should outlive the project's deletion as a tombstone.
  project_id    uuid references projects(id) on delete set null,
  created_at    timestamptz not null default now(),

  -- What was asked about.
  chain             text not null,
  tx_hash           text,
  protocol_address  text,
  entry_function    text,

  -- The resolution itself. These are the aggregation keys.
  -- txid_code is TEXT because the Resolution type defines it as a string; the
  -- registry keys are stable identifiers, not arithmetic.
  txid_code         text not null,
  category          text not null,
  status            text not null,
  custody           text not null,
  next_action_owner text not null,
  retryable         text,
  cause             text,
  recommended_action text,
  basis             text not null,

  -- Which product produced it. Lets a protocol see that support and API agree,
  -- and lets us tell a live user question apart from a batch API sweep.
  source        text not null check (source in ('api','agent','console')),

  -- The raw chain string behind the diagnosis, kept so a disputed answer can be
  -- checked against what the chain actually said.
  raw_status    text,
  -- Per-row detail: evidence items, decoded arguments, market names.
  evidence      jsonb not null default '[]'::jsonb
);

-- The three reads this table exists to serve.
create index if not exists resolutions_project_time_idx
  on resolutions (project_id, created_at desc);
create index if not exists resolutions_project_code_idx
  on resolutions (project_id, txid_code);
create index if not exists resolutions_project_chain_time_idx
  on resolutions (project_id, chain, created_at desc);

-- Append-only, with the ONE exception that keeps project erasure working.
-- See 20260804000002: `on delete set null` is implemented as an UPDATE, so a
-- blanket guard here would make admin_erase_project() fail for any project that
-- had ever produced a resolution, which is every project.
create or replace function reject_resolution_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.project_id is not null
     and new.project_id is null
     and to_jsonb(new) - 'project_id' = to_jsonb(old) - 'project_id'
  then
    return new;
  end if;
  raise exception 'resolutions is append-only' using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists resolutions_append_only_update on resolutions;
create trigger resolutions_append_only_update
  before update on resolutions
  for each row execute function reject_resolution_mutation();

-- DELETE is deliberately NOT blocked. Both the erasure path and demo cleanup
-- need to remove rows, and blocking it repeats the exact mistake that broke
-- admin_erase_project(). Retention is a policy question, not a trigger.
