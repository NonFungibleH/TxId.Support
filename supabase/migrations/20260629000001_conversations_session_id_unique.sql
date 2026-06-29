-- Fix: conversations.session_id must be UNIQUE for the upsert ON CONFLICT
-- clause in persistMessages() to resolve correctly. Without this constraint
-- the upsert throws a PostgreSQL error that was being silently caught.
ALTER TABLE conversations
ADD CONSTRAINT conversations_session_id_key UNIQUE (session_id);
