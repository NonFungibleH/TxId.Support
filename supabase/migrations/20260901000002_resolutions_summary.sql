-- The Console's case list needs the one-line summary and the customer it
-- belongs to without unpacking jsonb for every row, and "which of your
-- contracts is failing" needs the protocol address as a grouping key.
--
-- Additive columns only: existing rows keep working, nothing is rewritten.

alter table resolutions add column if not exists summary text;
-- The customer as the protocol knows them, when we can resolve the wallet.
-- Denormalised deliberately: a case list joining identities per row would pay
-- the join on every render for a value that cannot change retroactively.
alter table resolutions add column if not exists customer_ref text;
alter table resolutions add column if not exists wallet text;

-- "Which of my contracts fails most", the question a protocol actually asks.
create index if not exists resolutions_project_protocol_idx
  on resolutions (project_id, protocol_address, created_at desc);
-- A customer's own history, the Console's timeline read.
create index if not exists resolutions_project_customer_idx
  on resolutions (project_id, customer_ref, created_at desc);
