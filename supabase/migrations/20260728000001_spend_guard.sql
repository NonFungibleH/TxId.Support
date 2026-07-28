-- Daily spend circuit breaker (cost audit).
--
-- token_usage was written but never read to make a decision: nothing sat
-- between "attack starts" and "the Anthropic invoice arrives". This function
-- gives /api/chat a single cheap aggregate to check before it calls the model.
--
-- Returns today's (UTC) total tokens for one project AND for the whole
-- platform in one pass over the day's rows, so the pre-flight check is one
-- round-trip rather than a client-side sum. The caller caches the result for a
-- short window, so this runs at most a couple of times a minute per project
-- even under a flood.
--
-- The day boundary is computed as a timestamptz ("at time zone 'utc'" twice:
-- once to get the UTC wall clock, once to turn the truncated value back into
-- an instant) so the comparison stays correct, and index-usable, whatever the
-- database session timezone is.

create or replace function daily_token_spend(p_project_id uuid)
returns table (
  project_tokens  bigint,
  platform_tokens bigint
)
language sql
security definer
stable
as $$
  select
    coalesce(sum(input_tokens + output_tokens) filter (where project_id = p_project_id), 0)::bigint as project_tokens,
    coalesce(sum(input_tokens + output_tokens), 0)::bigint                                          as platform_tokens
  from token_usage
  where created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
$$;
