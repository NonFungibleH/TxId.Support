-- The ledger version a resolution was true as of.
--
-- The API response has always carried this: `chain_state_at` is what makes an
-- answer REPLAYABLE, because an integrator can re-read the chain at that exact
-- height and check what we said. The stored row did not have a column for it,
-- so it was persisted only inside `evidence` as a `parameter` item, where it is
-- not queryable and not usable as a join key.
--
-- Nullable on purpose, and it must stay nullable. A chain state is read AFTER
-- the answer has streamed, so it costs the user no latency, and a read that did
-- not complete leaves it NULL. NULL means NOT READ. It does not mean zero and
-- it does not mean genesis, and nothing may treat it as either: that is the
-- same rule the rest of this codebase applies to every absent value.
alter table resolutions
  add column if not exists chain_state_at text;

comment on column resolutions.chain_state_at is
  'Ledger version / block height the resolution was true as of. NULL means NOT READ, never zero.';

-- Resolutions are queried by chain and by code for the gaps view; adding the
-- height to that index keeps a "what did we say about this chain at this
-- height" lookup cheap without a second index.
create index if not exists resolutions_chain_state_idx
  on resolutions (chain, chain_state_at);
