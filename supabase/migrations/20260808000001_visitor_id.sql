-- Recognise a returning user across conversations.
--
-- WHY A NEW COLUMN RATHER THAN PERSISTING session_id: the session id is what
-- the message cap and the conversation count key on. Making it durable would
-- mean one conversation row that grows forever and a tester who is locked out
-- of the assistant the moment they hit the per-session cap, permanently, with
-- no way back. A visit and a visitor are different things and need different
-- identifiers.
--
-- The visitor id is a random value the widget keeps in the embedding site's
-- localStorage. It is NOT an identity: it does not survive a cleared browser,
-- private browsing, or a second device, and it is deliberately not derived
-- from anything about the person. It answers "is this the same browser coming
-- back", nothing more. Where a wallet is connected, that is the stronger
-- signal and the application prefers it.

alter table conversations add column if not exists visitor_id text;

-- Both lookups are "every conversation from this same user, within this
-- project", which is the query the Conversations page runs per page of rows.
create index if not exists conversations_project_visitor_idx
  on conversations (project_id, visitor_id)
  where visitor_id is not null;

create index if not exists conversations_project_wallet_idx
  on conversations (project_id, wallet_address)
  where wallet_address is not null;

comment on column conversations.visitor_id is
  'Random per-browser id from the embed''s localStorage. Recognises a returning browser, not a person. Cleared with site data; absent in private browsing.';
