-- Enable RLS on all tables
alter table organisations    enable row level security;
alter table projects         enable row level security;
alter table documents        enable row level security;
alter table conversations    enable row level security;
alter table messages         enable row level security;
alter table rate_limits      enable row level security;
alter table indexing_jobs    enable row level security;

-- Organisations: users see only their own org
create policy "orgs_select_own" on organisations
  for select using (
    clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
  );

create policy "orgs_delete_own" on organisations
  for delete using (
    clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
  );

-- Projects: users see/manage only their org's projects
create policy "projects_select_own_org" on projects
  for select using (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

create policy "projects_insert_own_org" on projects
  for insert with check (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

create policy "projects_update_own_org" on projects
  for update using (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

create policy "projects_delete_own_org" on projects
  for delete using (
    org_id in (
      select id from organisations
      where clerk_org_id = (current_setting('request.jwt.claims', true)::jsonb->>'org_id')
    )
  );

-- Note: documents, conversations, messages, rate_limits, indexing_jobs are
-- accessed exclusively via SERVICE_ROLE key from edge functions — RLS is
-- enabled but no anon/authenticated policies are needed. Service role bypasses
-- all RLS policies.
