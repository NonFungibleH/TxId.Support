-- Per-user attribution on tickets (bug reports / feedback / escalations).
--
-- WHY: a protocol that supplies the user's wallet from its own site (via the
-- widget's identify() host API) wants to track a bug report back to the user
-- who hit it. The ticket had no wallet column, so a finding could not be
-- attributed. This adds it, plus an index so "all findings from this wallet"
-- is a real query rather than a scan.
--
-- The address is ASSERTED by the host page, not proven by a signature. It is an
-- identifier for tracking, never an authorisation. Nothing in the product treats
-- a ticket's wallet as proof of ownership.

alter table public.tickets add column if not exists wallet_address text;

create index if not exists tickets_project_wallet_idx
  on public.tickets (project_id, wallet_address)
  where wallet_address is not null;
