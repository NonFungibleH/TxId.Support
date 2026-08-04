-- Case record integrity: append-only records, and a log of who read them.
--
-- WHY: the case record is what an institutional buyer is actually purchasing.
-- A record that can be silently edited or deleted is not evidence of anything,
-- and "who looked at this client's case?" is among the first questions a
-- compliance reviewer asks. Both are properties of the store, not the app, so
-- they are enforced in the database where no application bug can bypass them.

-- ============================================
-- APPEND-ONLY MESSAGES
-- ============================================

-- Feedback is the one field that legitimately changes after the fact (the
-- thumbs control in the widget), so it stays writable. Everything that
-- constitutes the record does not.
create or replace function messages_reject_rewrite()
returns trigger
language plpgsql
as $$
begin
  if new.content is distinct from old.content
     or new.role is distinct from old.role
     or new.evidence is distinct from old.evidence
     or new.created_at is distinct from old.created_at
     or new.conversation_id is distinct from old.conversation_id then
    raise exception
      'messages are append-only: content, role, evidence, conversation and timestamp cannot be rewritten (message %)', old.id
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_no_rewrite on messages;
create trigger messages_no_rewrite
  before update on messages
  for each row execute function messages_reject_rewrite();

-- ============================================
-- DELETION ONLY THROUGH AN ERASURE PATH
-- ============================================

-- A blanket block would make GDPR erasure impossible, so deletion is allowed
-- only when a caller has explicitly opted into it for the current transaction.
-- Ordinary application code never sets this, so an accidental or malicious
-- delete fails loudly instead of quietly succeeding.
create or replace function require_erasure_intent()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.erasure', true), 'off') <> 'on' then
    raise exception
      'case records cannot be deleted directly: use erase_conversation() or admin_erase_project(), which record the erasure'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists messages_no_delete on messages;
create trigger messages_no_delete
  before delete on messages
  for each row execute function require_erasure_intent();

drop trigger if exists conversations_no_delete on conversations;
create trigger conversations_no_delete
  before delete on conversations
  for each row execute function require_erasure_intent();

-- ============================================
-- ACCESS LOG
-- ============================================

create table if not exists case_access_log (
  id              uuid primary key default gen_random_uuid(),
  -- NOT cascade: an erase tombstone must outlive the project it describes,
  -- otherwise deleting a project silently deletes the evidence that it was
  -- deleted. Nullable so the row survives with its detail intact.
  project_id      uuid references projects(id) on delete set null,
  -- Null for a project-wide action such as a list view or a full export.
  conversation_id uuid,
  actor           text not null,
  action          text not null check (action in ('view', 'export', 'erase')),
  detail          jsonb,
  created_at      timestamptz not null default now()
);

comment on table case_access_log is
  'Who read or erased a case record, and when. Answers "who has seen this client''s data?" without storing IP addresses.';

create index if not exists case_access_log_project_idx on case_access_log (project_id, created_at desc);
create index if not exists case_access_log_conversation_idx on case_access_log (conversation_id, created_at desc);

alter table case_access_log enable row level security;

-- The log is evidence too: append and read only, with no rewrite path at all.
create or replace function reject_always()
returns trigger
language plpgsql
as $$
begin
  raise exception 'case_access_log is append-only' using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists case_access_log_no_rewrite on case_access_log;
create trigger case_access_log_no_rewrite
  before update or delete on case_access_log
  for each row execute function reject_always();

-- ============================================
-- ERASURE, RECORDED
-- ============================================

-- Erasing a conversation is itself an event worth keeping: the tombstone
-- survives so a later reviewer can see that something was removed, by whom,
-- rather than finding an unexplained gap.
create or replace function erase_conversation(target_conversation_id uuid, actor_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project uuid;
begin
  select project_id into target_project from conversations where id = target_conversation_id;
  if target_project is null then
    raise exception 'conversation % not found', target_conversation_id;
  end if;

  insert into case_access_log (project_id, conversation_id, actor, action, detail)
  values (target_project, target_conversation_id, actor_id, 'erase',
          jsonb_build_object('reason', 'erasure requested', 'erased_at', now()));

  perform set_config('app.erasure', 'on', true);
  delete from conversations where id = target_conversation_id;
  perform set_config('app.erasure', 'off', true);
end;
$$;

-- Deleting a demo project cascades into its conversations, which the delete
-- guard would otherwise block. Admin-only, and it records what it removed.
create or replace function admin_erase_project(target_project_id uuid, actor_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into case_access_log (project_id, conversation_id, actor, action, detail)
  values (target_project_id, null, actor_id, 'erase',
          jsonb_build_object(
            'reason', 'project deleted',
            'erased_at', now(),
            'project_id', target_project_id,
            'project_name', (select name from projects where id = target_project_id)));

  perform set_config('app.erasure', 'on', true);
  delete from projects where id = target_project_id;
  perform set_config('app.erasure', 'off', true);
end;
$$;
