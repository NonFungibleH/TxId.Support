-- Conversation intelligence: a one-line AI summary + category + sentiment per
-- conversation, so the dashboard Conversations page is scannable. Generated
-- lazily (see summarizeStaleConversations). last_message_at is denormalised so
-- "needs re-summary" is a cheap column compare instead of a join.

alter table conversations add column if not exists summary         text;
alter table conversations add column if not exists category        text;
alter table conversations add column if not exists sentiment       text;
alter table conversations add column if not exists summarized_at   timestamptz;
alter table conversations add column if not exists last_message_at timestamptz;

-- Backfill last_message_at for existing rows from their newest message
-- (falls back to the conversation's created_at when it has no messages yet).
update conversations c
set last_message_at = coalesce(
  (select max(m.created_at) from messages m where m.conversation_id = c.id),
  c.created_at
)
where c.last_message_at is null;

-- Stale-first selection index (summarized_at null or older than last_message_at).
create index if not exists conversations_summary_stale_idx
  on conversations(project_id, last_message_at desc);

-- Stale = never summarised, or messaged since the last summary. PostgREST can't
-- compare two columns, so the predicate lives here. SECURITY DEFINER + explicit
-- project scoping; the caller (a server action) has already checked ownership.
create or replace function stale_conversations(p_project uuid, p_limit int default 8)
returns table (id uuid)
language sql
stable
security definer
as $$
  select c.id
  from conversations c
  where c.project_id = p_project
    and (c.summarized_at is null or c.last_message_at > c.summarized_at)
  order by c.last_message_at desc nulls last
  limit greatest(1, least(p_limit, 25))
$$;
