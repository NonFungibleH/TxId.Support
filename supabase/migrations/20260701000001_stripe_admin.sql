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
