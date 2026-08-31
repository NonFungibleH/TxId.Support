-- Reply provenance: the moment an agent copies or exports a customer-facing
-- reply is the moment TxID's words become the company's words to their
-- customer. That event belongs in the same append-only access log as views
-- and exports, so "what exactly did we tell the customer, and when" has one
-- answer in one place.
--
-- CHECK constraints cannot be altered in place; drop and re-add. Safe to
-- re-run: the constraint name is stable.

alter table case_access_log drop constraint if exists case_access_log_action_check;
alter table case_access_log add constraint case_access_log_action_check
  check (action in ('view', 'export', 'erase', 'reply'));
