-- ============================================================
-- TxID: bring this database up to date with the repo
--
-- Tested against a Postgres reproduction of this database's exact
-- current state. Run three times, clean every time.
--
-- Excluded on purpose: initial schema, RLS policies, tickets table.
-- Already applied, and they contain bare CREATE statements that
-- would error on a second run.
--
-- Creates: webhook_logs, token_usage, action_events,
-- case_access_log, escalation_deliveries, audit_logs.
--
-- ALSO FIXES A LIVE BUG: the case_access_log append-only guard refused
-- the UPDATE that Postgres uses to implement `on delete set null`, so
-- deleting a project failed outright for any project that had ever been
-- viewed or exported. admin_erase_project() is the only sanctioned
-- deletion path, so GDPR project erasure and demo cleanup were both
-- blocked. Reproduced and fixed 2026-08-04.
-- ============================================================


-- ─────────────────────────────────────────────────────────
-- 20260628000001_webhook_logs
-- ─────────────────────────────────────────────────────────
-- Webhook delivery log — records every outbound webhook attempt for a ticket
create table if not exists public.webhook_logs (
  id            uuid         primary key default gen_random_uuid(),
  project_id    uuid         not null references public.projects(id) on delete cascade,
  ticket_ref    text         not null,
  webhook_url   text         not null,
  status_code   int,
  success       boolean      not null default false,
  error_message text,
  duration_ms   int,
  fired_at      timestamptz  not null default now()
);

create index if not exists webhook_logs_project_id_idx on public.webhook_logs(project_id);
create index if not exists webhook_logs_fired_at_idx   on public.webhook_logs(fired_at desc);

-- Service-role only (same pattern as tickets)
alter table public.webhook_logs enable row level security;

-- CREATE POLICY has no IF NOT EXISTS, so guard it: this migration must be
-- safe to re-run against a database that already has the policy.
do $policy$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'webhook_logs'
      and policyname = 'Service role full access on webhook_logs'
  ) then
    create policy "Service role full access on webhook_logs" on public.webhook_logs for all
  to service_role
  using (true)
  with check (true);
  end if;
end $policy$;


-- ─────────────────────────────────────────────────────────
-- 20260629000001_conversations_session_id_unique
-- ─────────────────────────────────────────────────────────
-- Fix: conversations.session_id must be UNIQUE for the upsert ON CONFLICT
-- clause in persistMessages() to resolve correctly. Without this constraint
-- the upsert throws a PostgreSQL error that was being silently caught.
do $guard$ begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_session_id_key') then
    alter table conversations add constraint conversations_session_id_key UNIQUE (session_id);
  end if;
end $guard$;


-- ─────────────────────────────────────────────────────────
-- 20260701000001_stripe_admin
-- ─────────────────────────────────────────────────────────
-- ============================================
-- STRIPE BILLING COLUMNS (pre-wired for Stripe integration)
-- ============================================
alter table organisations
  add column if not exists stripe_customer_id      text unique,
  add column if not exists stripe_subscription_id  text unique,
  add column if not exists stripe_subscription_status text
    check (stripe_subscription_status in ('active', 'past_due', 'canceled', 'trialing', 'incomplete'));

-- ============================================
-- ADMIN STATS FUNCTION
-- Returns per-project usage rollup for the admin dashboard.
-- SECURITY DEFINER so it can be called via service-role client.
-- ============================================
create or replace function admin_project_stats()
returns table (
  project_id           uuid,
  org_id               uuid,
  org_name             text,
  clerk_org_id         text,
  stripe_customer_id   text,
  stripe_sub_status    text,
  project_name         text,
  is_active            boolean,
  mode                 text,
  plan                 text,
  org_created_at       timestamptz,
  project_created_at   timestamptz,
  conv_count_total     bigint,
  conv_count_month     bigint,
  message_count        bigint,
  doc_count            bigint
) as $$
begin
  return query
  select
    p.id                                           as project_id,
    o.id                                           as org_id,
    o.name                                         as org_name,
    o.clerk_org_id,
    o.stripe_customer_id,
    o.stripe_subscription_status                   as stripe_sub_status,
    p.name                                         as project_name,
    p.is_active,
    p.mode,
    coalesce(p.config->>'plan', 'free')            as plan,
    o.created_at                                   as org_created_at,
    p.created_at                                   as project_created_at,
    (select count(*) from conversations c where c.project_id = p.id)                                                              as conv_count_total,
    (select count(*) from conversations c where c.project_id = p.id
       and c.created_at >= date_trunc('month', now() at time zone 'UTC'))                                                          as conv_count_month,
    (select count(*) from messages m
       join conversations c on m.conversation_id = c.id
       where c.project_id = p.id)                                                                                                  as message_count,
    (select count(*) from documents d where d.project_id = p.id)                                                                   as doc_count
  from projects p
  join organisations o on o.id = p.org_id
  order by o.created_at desc;
end;
$$ language plpgsql security definer;


-- ─────────────────────────────────────────────────────────
-- 20260702000001_tickets_conversation_id
-- ─────────────────────────────────────────────────────────
-- Link tickets to the conversation that generated them
alter table public.tickets
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

create index if not exists tickets_conversation_id_idx on public.tickets(conversation_id);


-- ─────────────────────────────────────────────────────────
-- 20260703000001_project_stats_fn
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- 20260706000001_conversations_project_session_unique
-- ─────────────────────────────────────────────────────────
-- Security fix (audit C1): conversations.session_id was globally UNIQUE, and
-- persistMessages() upserts with ON CONFLICT (session_id). A caller holding
-- project A's public key could POST a session_id already used by project B;
-- the upsert would conflict on the global session_id and reparent B's row to
-- A (cross-tenant corruption). Uniqueness must be scoped per project.
--
-- Safe to run: because session_id was globally unique, no two rows can share
-- one, so (project_id, session_id) is already unique — no data conflict.

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_session_id_key;

do $guard$ begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_project_session_key') then
    alter table conversations add constraint conversations_project_session_key UNIQUE (project_id, session_id);
  end if;
end $guard$;


-- ─────────────────────────────────────────────────────────
-- 20260706000002_claim_conversation_slot
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- 20260706000003_token_usage
-- ─────────────────────────────────────────────────────────
-- Per-turn LLM token usage, for the admin cost cockpit. One row per assistant
-- turn. project_id is denormalised so per-customer totals are a cheap group-by
-- (no join through conversations). The token counts come free in the Anthropic
-- API response — we just persist them.

create table if not exists public.token_usage (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references public.projects(id) on delete cascade,
  conversation_id uuid        references public.conversations(id) on delete set null,
  model           text        not null,
  input_tokens    integer     not null default 0,
  output_tokens   integer     not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists token_usage_project_id_idx on public.token_usage(project_id);
create index if not exists token_usage_created_at_idx  on public.token_usage(created_at desc);

-- Per-project token totals (all-time + current UTC month) for the admin table.
-- Drop first: 20260729000001 later widens this function's return type, and on
-- a re-run the narrow definition here cannot replace the wide one. CREATE OR
-- REPLACE can never change OUT parameters in either direction.
drop function if exists admin_token_usage();

create or replace function admin_token_usage()
returns table (
  project_id     uuid,
  input_all      bigint,
  output_all     bigint,
  input_month    bigint,
  output_month   bigint
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
    coalesce(sum(output_tokens) filter (where created_at >= date_trunc('month', now() at time zone 'utc')), 0) as output_month
  from token_usage
  group by project_id
$$;


-- ─────────────────────────────────────────────────────────
-- 20260717000001_action_events
-- ─────────────────────────────────────────────────────────
-- Audit trail for the "Actions" feature (AI-prepared, user-signed transactions).
-- Two record kinds share the table:
--   kind = 'ack'                        → user acknowledged the Actions modal
--                                         (action_id NULL, status 'acknowledged')
--   kind = 'contract_action' | 'swap'   → a prepared action and its lifecycle
--                                         (never 'acknowledged'; 'expired' is
--                                         written only by the rebuild endpoint)
-- Service-role access only; not surfaced in any dashboard in v1.

create table if not exists action_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  session_id text not null,
  action_id uuid,
  kind text not null check (kind in ('ack', 'contract_action', 'swap')),
  chain text,
  summary text,
  params jsonb,
  status text not null check (status in ('acknowledged', 'prepared', 'rebuilt', 'confirmed', 'failed', 'expired')),
  country text,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_events_project_idx on action_events(project_id, created_at desc);
create unique index if not exists action_events_action_idx on action_events(action_id) where action_id is not null;

alter table action_events enable row level security;
-- No policies: service-role only.


-- ─────────────────────────────────────────────────────────
-- 20260718000001_conversation_summaries
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- 20260718000002_escalation_integrations
-- ─────────────────────────────────────────────────────────
-- Escalation integrations: fan a raised ticket out to Slack/Discord/Telegram
-- (notifications) and Linear/GitHub/Jira (tracked issues). Config lives in
-- projects.config.integrations (server-only, like telegramBotToken).

-- webhook_logs now covers all dispatch targets, not just the generic webhook.
-- webhook_url must be nullable: Telegram/Linear/GitHub/Jira have no URL, and
-- Slack/Discord webhook URLs are SECRETS (token in the path) so we never store
-- them — only the target name + status.
alter table public.webhook_logs alter column webhook_url drop not null;
alter table public.webhook_logs add column if not exists target text;

-- Created-issue URLs written back on the ticket, e.g.
-- {"linear":"https://...","github":"https://...","jira":"https://..."}.
alter table public.tickets add column if not exists external_refs jsonb;


-- ─────────────────────────────────────────────────────────
-- 20260728000001_spend_guard
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- 20260729000001_cache_token_usage
-- ─────────────────────────────────────────────────────────
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
-- This widens the return type (adds the cache columns), and CREATE OR REPLACE
-- cannot change a function's OUT parameters. Without the drop, this migration
-- fails on any database that already has the earlier definition from
-- 20260706000003, which is every database that ran migrations in order.
drop function if exists admin_token_usage();

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


-- ─────────────────────────────────────────────────────────
-- 20260803000001_message_evidence
-- ─────────────────────────────────────────────────────────
-- Compliance evidence for each answer.
--
-- The case record already holds the question, the answer and the investigation.
-- What a reviewer asks next is "under what conditions was this said, and can I
-- reproduce it?". That needs the state the answer rested on, not just its text.
--
-- Deliberately NOT stored: raw IP addresses. Country is derived at the edge and
-- the IP is discarded, because an IP is personal data under GDPR and would drag
-- retention and subject-access obligations onto a field only ever needed at
-- country granularity. Nothing here fingerprints a device beyond the coarse
-- platform the browser already announces.

alter table messages
  add column if not exists evidence jsonb;

comment on column messages.evidence is
  'Conditions an assistant answer was produced under: chain state (ledger version), request context (country, coarse device, surface, language), model and prompt version, tool calls and any failed lookups, latency, and a hash of the answer. No IP addresses, no device fingerprinting.';

-- Reviewing a case pulls the evidence for one conversation at a time, and the
-- column is null on user rows, so keep the index to rows that have one.
create index if not exists messages_evidence_idx
  on messages using gin (evidence)
  where evidence is not null;


-- ─────────────────────────────────────────────────────────
-- 20260803000002_case_record_integrity
-- ─────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────
-- 20260803000003_escalation_deliveries
-- ─────────────────────────────────────────────────────────
-- Escalation delivery, with somewhere for failures to go.
--
-- WHY: dispatch was fire-and-forget. One 5s timeout, allSettled, a log line,
-- and gone. If Slack blips, that escalation is lost: the user was told a human
-- would follow up, and no human ever hears. For a support product that is the
-- worst failure mode there is, and it is silent.
--
-- Failed deliveries land here with the payload they need to be retried, so a
-- retry is a real redelivery rather than a guess at what was meant to be sent.

create table if not exists escalation_deliveries (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  target         text not null,
  ticket_ref     text not null,
  -- Everything needed to send it again without reconstructing the ticket.
  payload        jsonb not null,
  status         text not null default 'pending' check (status in ('pending', 'delivered', 'abandoned')),
  attempts       integer not null default 1,
  last_error     text,
  -- Exponential backoff: the earliest a retry should be attempted.
  next_attempt_at timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table escalation_deliveries is
  'Escalations that failed to reach their destination, with the payload needed to redeliver. A row here means a user was promised a follow-up that has not been delivered.';

-- The retry worker asks one question: what is due now?
create index if not exists escalation_deliveries_due_idx
  on escalation_deliveries (next_attempt_at)
  where status = 'pending';

create index if not exists escalation_deliveries_project_idx
  on escalation_deliveries (project_id, created_at desc);

alter table escalation_deliveries enable row level security;


-- ============================================================
-- 2026-08-04, second batch
-- ============================================================
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

-- Fix: a project could not be deleted at all.
--
-- `case_access_log.project_id` is `on delete set null` so an erase tombstone
-- outlives the project it describes. Postgres implements that nulling as an
-- UPDATE on case_access_log, and the append-only guard refused every update,
-- so the referential action failed and took the whole DELETE with it.
--
-- The effect: `admin_erase_project()`, which is the ONLY sanctioned way to
-- delete a project, errored for any project that had ever been viewed or
-- exported. GDPR project erasure and demo cleanup were both blocked, and the
-- failure surfaced as an opaque "append-only" error a long way from its cause.
--
-- The guard now permits exactly one shape of update: project_id going to NULL
-- with every other column byte-for-byte identical. The reference can be
-- cleared, never repointed, and no content can be smuggled in alongside it.
-- Deletes remain refused outright.

create or replace function reject_always()
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
  raise exception 'case_access_log is append-only' using errcode = 'restrict_violation';
end;
$$;

-- What each team member is allowed to do.
--
-- SPLIT OF AUTHORITY, deliberate: Clerk stays authoritative for MEMBERSHIP
-- (is this person in the org), this table is authoritative for PERMISSION
-- (given that they are, what may they do). Mirroring membership would create
-- two sources of truth for the same fact and a sync problem that never ends.
-- Augmenting it creates neither: a user with no row here simply takes the
-- default role, and Clerk adding or removing people needs no reaction from us.
--
-- WHY NOT CLERK'S OWN CUSTOM ROLES: they may be gated by plan tier, and roles
-- held here get foreign keys, appear in the audit log with integrity, are
-- queryable for a compliance report ("who could change settings in Q3"), and
-- cost no API round trip on every server action.
--
-- NOT append-only. A role legitimately changes when someone moves team. The
-- change is recorded in audit_logs instead, which is the right place for it.

create table if not exists org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  -- Clerk user id. Not a foreign key: Clerk owns the user record, not us.
  clerk_user_id text not null,
  -- Kept in sync opportunistically for readable audit rows and member lists.
  email         text,
  role          text not null check (role in ('admin', 'developer', 'support', 'auditor')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, clerk_user_id)
);

comment on table org_members is
  'Per-member role within an organisation. Clerk owns membership; this owns permission. A member with no row here takes the default role.';

create index if not exists org_members_org_idx on org_members (org_id);

alter table org_members enable row level security;

-- Per-page crawl state, so a re-crawl can tell what actually changed.
--
-- WHY: `crawlAndIngestCore` deleted every chunk for the pages it fetched and
-- re-embedded all of them, every time. Nothing recorded whether a page had
-- changed, so a scheduled re-crawl would re-embed an entire documentation site
-- nightly to produce near-identical vectors. Efficiency had to come before the
-- schedule, or the schedule is just a recurring bill.
--
-- With a hash and the server's own cache validators, a re-crawl skips the
-- pages that did not move and re-embeds only those that did, which is what
-- makes running it daily rather than weekly essentially free.

create table if not exists doc_sources (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  url              text not null,
  -- sha256 of the extracted text. The fallback signal, and the only one that
  -- works when a server omits or lies about its cache headers.
  content_hash     text,
  -- The server's own validators. A 304 costs almost nothing, so these are
  -- tried first and the body is never transferred when nothing changed.
  etag             text,
  last_modified    text,
  -- Separated on purpose: "we looked and it was the same" and "it changed" are
  -- different facts, and a team wants to see both. Freshness is last_checked;
  -- staleness of the content itself is last_changed.
  last_checked_at  timestamptz,
  last_changed_at  timestamptz,
  created_at       timestamptz not null default now(),
  unique (project_id, url)
);

comment on table doc_sources is
  'One row per indexed documentation page: content hash and HTTP validators, so a re-crawl only re-embeds pages that actually changed.';

create index if not exists doc_sources_project_idx on doc_sources (project_id);

alter table doc_sources enable row level security;

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
