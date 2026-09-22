-- Activation: one row per project and wallet the readiness check has seen.
--
-- WHAT IT IS FOR: the one number a protocol will judge the readiness check by,
-- whether more new wallets reach a first successful action with it than
-- without. So the row records which group the wallet was in (arm), whether it
-- was proven new, and when its first success landed.
--
-- `status` is the honesty of the whole table:
--   pending   its history has not been read in full, so we do not know if it is new
--   new       read in full, no earlier success with the protocol
--   existing  had already used the protocol when first seen; excluded from the rate
-- A pending wallet is never counted as new. See lib/activation/cohort.ts.
--
-- Nothing reads or writes this unless a project turns activation on, and the
-- application treats a missing table as "nothing to record", so deploying the
-- code before this migration degrades rather than breaks.

create table if not exists activation_wallets (
  project_id uuid not null references projects(id) on delete cascade,
  wallet_address text not null,
  chain text not null,
  arm text not null check (arm in ('shown', 'holdout')),
  status text not null default 'pending' check (status in ('pending', 'new', 'existing')),
  first_seen_at timestamptz not null default now(),
  prompted_at timestamptz,
  opened_at timestamptz,
  dismissed_at timestamptz,
  failure_seen_at timestamptz,
  activated_at timestamptz,
  activation_tx text,
  -- The last check whose history reached back to first_seen_at. Not simply the
  -- last check: one that could not see that far proves nothing about the window.
  last_checked_at timestamptz,
  primary key (project_id, wallet_address)
);

-- The re-check job: wallets still inside their window, not yet activated.
create index if not exists activation_wallets_recheck_idx
  on activation_wallets (first_seen_at)
  where activated_at is null and status in ('pending', 'new');

alter table activation_wallets enable row level security;
-- No policies: service-role only, like action_events.

comment on table activation_wallets is
  'Readiness check cohort: arm, proven-new status and first successful action per wallet. Written only for projects with activation on.';
