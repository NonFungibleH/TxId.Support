-- ============================================================
-- PASTE INTO THE SUPABASE SQL EDITOR
--
-- Safe to run more than once: every statement is idempotent
-- (if not exists / or replace). Run the whole file in one go.
--
-- Covers the migrations that may not have been applied yet.
-- ============================================================


-- ─────────────────────────────────────────────────────────
-- 20260702000001_tickets_conversation_id
-- ─────────────────────────────────────────────────────────
-- Link tickets to the conversation that generated them
alter table public.tickets
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

create index if not exists tickets_conversation_id_idx on public.tickets(conversation_id);


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

