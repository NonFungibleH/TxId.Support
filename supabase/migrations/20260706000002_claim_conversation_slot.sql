-- Atomic conversation-quota enforcement (audit H3).
--
-- The old flow read the monthly count, streamed the LLM response, then inserted
-- the conversation row afterwards — so N concurrent new sessions could all read
-- "under limit" before any row existed and all be admitted, letting a free
-- project blow past its cap (and run unbounded LLM cost).
--
-- This function serializes new-session admission per project with an advisory
-- lock, checks the monthly AND daily caps against committed rows, and inserts
-- the conversation row in the same transaction. Pass -1 for an unlimited cap.
--
-- Returns: 'ok' (slot claimed / already existed), 'month_limit', or 'day_limit'.

create or replace function claim_conversation_slot(
  p_project_id     uuid,
  p_session_id     text,
  p_monthly_limit  int,
  p_daily_limit    int
)
returns text
language plpgsql
security definer
as $$
declare
  v_exists      boolean;
  v_month_count int;
  v_day_count   int;
begin
  -- Existing session already counts against the quota — always allow.
  select exists(
    select 1 from conversations
    where project_id = p_project_id and session_id = p_session_id
  ) into v_exists;
  if v_exists then
    return 'ok';
  end if;

  -- Serialize concurrent NEW-session claims for this project so the counts
  -- below can't race. Transaction-scoped; released on commit/rollback.
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));

  if p_monthly_limit >= 0 then
    select count(*) into v_month_count from conversations
    where project_id = p_project_id
      and created_at >= date_trunc('month', now() at time zone 'utc');
    if v_month_count >= p_monthly_limit then
      return 'month_limit';
    end if;
  end if;

  if p_daily_limit >= 0 then
    select count(*) into v_day_count from conversations
    where project_id = p_project_id
      and created_at >= date_trunc('day', now() at time zone 'utc');
    if v_day_count >= p_daily_limit then
      return 'day_limit';
    end if;
  end if;

  insert into conversations (project_id, session_id)
  values (p_project_id, p_session_id)
  on conflict (project_id, session_id) do nothing;

  return 'ok';
end;
$$;
