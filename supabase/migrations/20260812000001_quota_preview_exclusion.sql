-- Preview sessions must not consume the paid conversation quota (launch audit H1).
--
-- WHY: the dashboard promises, on both Conversations and Analytics, that
-- preview sessions "never count toward your quota" - and the chat route indeed
-- SKIPS the claim for verified previews. But persistMessages still creates the
-- conversation row, and this function counted ALL rows for the month/day, so
-- every preview session inflated the count the next REAL session was judged
-- against. A trial customer who tested 30 conversations pre-launch had silently
-- spent 20% of their 150/month allowance while being told the opposite.
--
-- Preview sessions are identified by their session-id prefix ('preview-'),
-- the same derivation lib/conversation-source.ts uses, so this works
-- retroactively on every existing row with no new column.

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
  -- Existing session already counts against the quota - always allow.
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
      and session_id not like 'preview-%'
      and created_at >= date_trunc('month', now() at time zone 'utc');
    if v_month_count >= p_monthly_limit then
      return 'month_limit';
    end if;
  end if;

  if p_daily_limit >= 0 then
    select count(*) into v_day_count from conversations
    where project_id = p_project_id
      and session_id not like 'preview-%'
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
