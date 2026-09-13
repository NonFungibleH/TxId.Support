-- Which customer owns which wallet.
--
-- WHY THIS EXISTS: the Console's entire premise is that a support agent has an
-- email address and never a transaction hash. Without this mapping the product
-- degrades to a block explorer with better copy. The setup page has advertised
-- POST /api/v1/identity since it was written; this is the storage behind it.
--
-- APPEND-ONLY HISTORY, not a mutable row. A customer who changes wallet must
-- not silently erase what was true before: a case answered last March was
-- answered about the wallet they held in March, and an audit that cannot
-- reconstruct that is not an audit. "Current" is therefore the newest row per
-- (project, customer), never an UPDATE.

create table if not exists customer_identities (
  id            uuid primary key default gen_random_uuid(),
  -- Nullable + on delete set null, matching case_access_log and resolutions:
  -- the record of a mapping outlives the project as a tombstone.
  project_id    uuid references projects(id) on delete set null,
  created_at    timestamptz not null default now(),

  -- The customer as the PROTOCOL knows them. Their id in their own system is
  -- the durable key; email changes, and a person is not their email address.
  customer_ref  text not null,
  email         text,
  display_name  text,

  wallet        text not null,
  chain         text not null,

  -- How we came to believe it. A pushed pair is an assertion by the protocol;
  -- an agent-pasted one is a claim by whoever was on shift. An answer resting
  -- on the second deserves less confidence than one resting on the first, and
  -- that distinction is only available if it was recorded at the time.
  source        text not null check (source in ('pushed','crm_field','manual')),

  -- Set when a later row supersedes this one, so history reads without a
  -- window function. Written by the insert path, never by a user.
  superseded_at timestamptz
);

-- Newest-first per customer: the "current wallet" read.
create index if not exists customer_identities_current_idx
  on customer_identities (project_id, customer_ref, created_at desc);
-- The Console's reverse lookup: a wallet appears in a resolution, who is it?
create index if not exists customer_identities_wallet_idx
  on customer_identities (project_id, lower(wallet));
-- Agents search by email far more than by anything else.
create index if not exists customer_identities_email_idx
  on customer_identities (project_id, lower(email));

-- Append-only, with the ONE exception that keeps project erasure working, and
-- the supersede stamp. See 20260804000002: `on delete set null` is implemented
-- as an UPDATE, so a blanket guard breaks admin_erase_project() for every
-- project that has ever stored a mapping.
create or replace function reject_identity_mutation()
returns trigger
language plpgsql
as $$
begin
  -- The FK going to NULL, everything else byte-for-byte identical.
  if tg_op = 'UPDATE'
     and old.project_id is not null
     and new.project_id is null
     and to_jsonb(new) - 'project_id' = to_jsonb(old) - 'project_id'
  then
    return new;
  end if;
  -- Stamping a row as superseded, and nothing else. Once stamped it is final.
  if tg_op = 'UPDATE'
     and old.superseded_at is null
     and new.superseded_at is not null
     and to_jsonb(new) - 'superseded_at' = to_jsonb(old) - 'superseded_at'
  then
    return new;
  end if;
  raise exception 'customer_identities is append-only' using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists customer_identities_append_only on customer_identities;
create trigger customer_identities_append_only
  before update on customer_identities
  for each row execute function reject_identity_mutation();

comment on table customer_identities is
  'Append-only history of which customer held which wallet, and how we came to believe it. Current = newest row per (project_id, customer_ref).';
