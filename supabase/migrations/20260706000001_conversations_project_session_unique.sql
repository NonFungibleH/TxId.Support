-- Security fix (audit C1): conversations.session_id was globally UNIQUE, and
-- persistMessages() upserts with ON CONFLICT (session_id). A caller holding
-- project A's public key could POST a session_id already used by project B;
-- the upsert would conflict on the global session_id and reparent B's row to
-- A (cross-tenant corruption). Uniqueness must be scoped per project.
--
-- Safe to run: because session_id was globally unique, no two rows can share
-- one, so (project_id, session_id) is already unique — no data conflict.

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_session_id_key;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_project_session_key UNIQUE (project_id, session_id);
