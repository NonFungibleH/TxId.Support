-- Returns total message count for a project via a SQL join, avoiding the
-- O(n) pattern of fetching all conversation IDs into application memory.
create or replace function get_project_message_count(p_project_id uuid)
returns bigint
language sql
security definer
stable
as $$
  select count(m.id)
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.project_id = p_project_id
$$;

-- Returns escalation count for a project in a given time window.
create or replace function get_project_escalation_count(
  p_project_id uuid,
  p_since timestamptz
)
returns bigint
language sql
security definer
stable
as $$
  select count(*)
  from tickets t
  where t.project_id = p_project_id
    and t.created_at >= p_since
$$;
