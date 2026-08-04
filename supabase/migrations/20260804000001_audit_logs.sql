-- Who changed the configuration, and when.
--
-- WHY: the case record already proves what the assistant told a user and what
-- it read. It says nothing about the humans behind it. A buyer's security
-- review asks the obvious next question: who changed the escalation routing,
-- who regenerated the API key, who turned Actions on. Without an answer, every
-- claim about the case record is undermined by the fact that the settings
-- producing it can be changed silently.
--
-- Append-only, enforced here rather than in the application, for the same
-- reason the message record is: a log the application can rewrite is not
-- evidence of anything.

create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  -- Kept even if the project is deleted: "who deleted the project" is one of
  -- the questions this table exists to answer, so the row must outlive it.
  org_id      uuid references organisations(id) on delete set null,
  project_id  uuid references projects(id) on delete set null,
  -- Clerk user id. Seats and roles do not exist yet, so this is the one
  -- account with access; when seats land, the actor becomes meaningful
  -- without this column changing shape.
  actor_id    text not null,
  actor_email text,
  -- Dotted verb, e.g. "integration.saved", "key.rotated", "project.erased".
  action      text not null,
  -- What it was done to, in human terms ("Slack", "Jira", "Uniswap V3 Router").
  target      text,
  -- Never store a secret here. Store that a secret CHANGED, not its value.
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table audit_logs is
  'Append-only record of configuration changes made by a team member. Never contains credential values, only the fact that a credential changed.';

create index if not exists audit_logs_project_idx on audit_logs (project_id, created_at desc);
create index if not exists audit_logs_org_idx on audit_logs (org_id, created_at desc);

-- Append-only. An audit trail that can be edited is not an audit trail.
--
-- ONE EXCEPTION, AND IT IS NOT OPTIONAL: `on delete set null` is implemented by
-- Postgres as an UPDATE on this table, so a blanket UPDATE guard does not
-- protect the log, it makes deleting a project fail outright. The guard
-- therefore allows exactly one shape of update, the referential nulling, and
-- only when every other column is byte-for-byte unchanged. An FK can be
-- cleared, never repointed, and no content can ride along with it.
create or replace function audit_logs_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and (new.project_id is null or new.project_id = old.project_id)
     and (new.org_id is null or new.org_id = old.org_id)
     and to_jsonb(new) - 'project_id' - 'org_id' = to_jsonb(old) - 'project_id' - 'org_id'
  then
    return new;
  end if;
  raise exception 'audit_logs is append-only' using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists audit_logs_no_update on audit_logs;
create trigger audit_logs_no_update
  before update on audit_logs
  for each row execute function audit_logs_append_only();

drop trigger if exists audit_logs_no_delete on audit_logs;
create trigger audit_logs_no_delete
  before delete on audit_logs
  for each row execute function audit_logs_append_only();

alter table audit_logs enable row level security;
