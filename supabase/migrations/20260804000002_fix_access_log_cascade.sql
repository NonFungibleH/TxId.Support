-- Fix: a project could not be deleted at all.
--
-- `case_access_log.project_id` is `on delete set null` so an erase tombstone
-- outlives the project it describes. Postgres implements that nulling as an
-- UPDATE on case_access_log, and the append-only guard refused every update,
-- so the referential action failed and took the whole DELETE with it.
--
-- The effect: `admin_erase_project()`, which is the ONLY sanctioned way to
-- delete a project, errored for any project that had ever been viewed or
-- exported. GDPR project erasure and demo cleanup were both blocked, and the
-- failure surfaced as an opaque "append-only" error a long way from its cause.
--
-- The guard now permits exactly one shape of update: project_id going to NULL
-- with every other column byte-for-byte identical. The reference can be
-- cleared, never repointed, and no content can be smuggled in alongside it.
-- Deletes remain refused outright.

create or replace function reject_always()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.project_id is not null
     and new.project_id is null
     and to_jsonb(new) - 'project_id' = to_jsonb(old) - 'project_id'
  then
    return new;
  end if;
  raise exception 'case_access_log is append-only' using errcode = 'restrict_violation';
end;
$$;
