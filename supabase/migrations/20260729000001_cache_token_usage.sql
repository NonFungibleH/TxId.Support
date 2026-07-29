-- Prompt caching splits what used to be a single input_tokens figure across
-- three buckets: uncached input, cache writes (1.25x input price) and cache
-- reads (0.1x). Without these columns the cached prefix simply vanishes from
-- token_usage: the admin cockpit under-reports spend, and daily_token_spend
-- under-counts, so the circuit breaker would stop firing when it should.

alter table public.token_usage
  add column if not exists cache_read_tokens  integer not null default 0,
  add column if not exists cache_write_tokens integer not null default 0;

-- Cost-weighted total, in units of uncached input tokens, so a single number
-- stays comparable across the caching switchover. Weights are Anthropic's
-- multipliers against base input price: writes 1.25x, reads 0.1x.
create or replace function token_usage_billable(
  p_input integer, p_output integer, p_cache_read integer, p_cache_write integer
)
returns numeric
language sql
immutable
as $$
  select p_input + p_output + (p_cache_write * 1.25) + (p_cache_read * 0.1)
$$;

-- The circuit breaker must see cached tokens, otherwise a high-volume attacker
-- reading a cached prefix all day registers as almost no spend.
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
    coalesce(sum(token_usage_billable(input_tokens, output_tokens, cache_read_tokens, cache_write_tokens))
             filter (where project_id = p_project_id), 0)::bigint as project_tokens,
    coalesce(sum(token_usage_billable(input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)), 0)::bigint
                                                                  as platform_tokens
  from token_usage
  where created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
$$;

-- input_all / input_month keep their existing meaning (uncached input) so the
-- admin table's columns don't silently change definition; the cache buckets are
-- returned alongside for an accurate cost line.
create or replace function admin_token_usage()
returns table (
  project_id          uuid,
  input_all           bigint,
  output_all          bigint,
  input_month         bigint,
  output_month        bigint,
  cache_read_all      bigint,
  cache_write_all     bigint,
  cache_read_month    bigint,
  cache_write_month   bigint
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
    coalesce(sum(output_tokens) filter (where created_at >= date_trunc('month', now() at time zone 'utc')), 0) as output_month,
    coalesce(sum(cache_read_tokens), 0)  as cache_read_all,
    coalesce(sum(cache_write_tokens), 0) as cache_write_all,
    coalesce(sum(cache_read_tokens)  filter (where created_at >= date_trunc('month', now() at time zone 'utc')), 0) as cache_read_month,
    coalesce(sum(cache_write_tokens) filter (where created_at >= date_trunc('month', now() at time zone 'utc')), 0) as cache_write_month
  from token_usage
  group by project_id
$$;
