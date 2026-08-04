-- Turn the ticket list into something a person can actually work.
--
-- Tickets had status and a free-text notes field and nothing else: no owner,
-- no urgency, and no record of what was actually done. A team of four looking
-- at the same list cannot tell who is handling which, and the only trace of a
-- reply sent by email lived in somebody's sent folder.

alter table tickets add column if not exists assignee_id    text;
alter table tickets add column if not exists assignee_email text;
alter table tickets add column if not exists priority       text
  check (priority in ('low', 'normal', 'high', 'urgent'));
-- When someone first picked it up, and when it stopped being open. Together
-- with created_at these answer "how long did this take", which is the only
-- service question a support lead actually has.
alter table tickets add column if not exists first_response_at timestamptz;
alter table tickets add column if not exists resolved_at       timestamptz;

create index if not exists tickets_assignee_idx on tickets (project_id, assignee_id);

-- Everything that happened to a ticket, in order.
--
-- WHY A SEPARATE TABLE, NOT MORE COLUMNS: the audit trail an institutional
-- buyer asks for is a sequence, not a snapshot. "Status is resolved" does not
-- say who resolved it, when, or what was said to the user in between. A note
-- overwritten in place loses exactly the history that made it evidence.
--
-- `channel` records where a communication actually happened. A reply sent by
-- email from someone's own mailbox is invisible to this system unless it is
-- recorded here, and an audit trail with a hole in it where the reply went is
-- not an audit trail.
create table if not exists ticket_events (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references tickets(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  -- Clerk user id, or null when the system generated the event.
  actor_id    text,
  actor_email text,
  kind        text not null check (kind in (
    'note',            -- an internal note, not shown to the user
    'reply',           -- something said TO the user, on some channel
    'status_changed',
    'assigned',
    'priority_changed',
    'link'             -- a pointer to a CRM record, email thread or issue
  )),
  -- For 'reply' and 'link': where it happened.
  channel     text check (channel in ('email', 'telegram', 'discord', 'crm', 'other')),
  body        text,
  -- A URL into the system of record: the CRM contact, the email thread.
  url         text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table ticket_events is
  'Ordered history of everything done to a ticket, including communications sent outside TxID. Append-only: it is the audit trail, not a scratchpad.';

create index if not exists ticket_events_ticket_idx on ticket_events (ticket_id, created_at);
create index if not exists ticket_events_project_idx on ticket_events (project_id, created_at desc);

-- No rewriting history. DELETE is deliberately NOT blocked.
--
-- Both foreign keys cascade, so blocking delete would make deleting a ticket
-- fail, and with it `admin_erase_project()` and therefore GDPR project
-- erasure. That is exactly the bug already found on case_access_log, in a
-- different disguise: guard the operation that corrupts evidence (rewriting
-- it), never the one the database performs to keep referential integrity.
--
-- Deleting a ticket taking its history with it is also correct on the merits:
-- an erasure request should remove the record, and the project-level tombstone
-- in case_access_log is what preserves the fact that something was erased.
create or replace function ticket_events_no_rewrite()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ticket_events cannot be edited, only added to'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists ticket_events_no_update on ticket_events;
create trigger ticket_events_no_update
  before update on ticket_events
  for each row execute function ticket_events_no_rewrite();

alter table ticket_events enable row level security;
