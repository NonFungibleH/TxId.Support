-- Count unique wallets without reading every conversation.
--
-- The Overview card did `select wallet_address` with no bound and counted the
-- distinct values in JavaScript, so the query grew with the customer and the
-- busiest accounts got the slowest dashboard. That is exactly backwards, and it
-- is the kind of cost that stays invisible until the account you least want to
-- annoy is the one waiting.
--
-- PostgREST cannot express count(distinct …), which is why this is a function,
-- the same reason `stale_conversations` and `admin_token_usage` are functions.
-- The caller falls back to the old read if this has not been applied yet, so
-- deploying the code before the migration degrades rather than breaks.

create or replace function distinct_wallets(p_project_id uuid)
returns bigint
language sql
stable
as $$
  select count(distinct wallet_address)
  from conversations
  where project_id = p_project_id
    and wallet_address is not null;
$$;

comment on function distinct_wallets(uuid) is
  'Unique connected wallets for a project. Exists because PostgREST cannot express count(distinct).';
