-- Add mode column to projects table
-- Supports 'support' (AI chat + RAG) and 'token' (price widget + community)
ALTER TABLE projects
  ADD COLUMN mode text NOT NULL DEFAULT 'support'
  CONSTRAINT projects_mode_check CHECK (mode IN ('support', 'token'));
