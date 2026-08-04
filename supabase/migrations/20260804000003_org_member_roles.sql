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
