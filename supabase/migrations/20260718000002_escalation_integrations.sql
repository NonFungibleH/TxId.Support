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
