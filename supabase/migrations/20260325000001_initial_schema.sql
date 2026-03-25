-- Enable pgvector extension
create extension if not exists vector;

-- ============================================
-- ORGANISATIONS (Clerk org IDs map to these)
-- ============================================
create table organisations (
  id           uuid primary key default gen_random_uuid(),
  clerk_org_id text unique not null,
  name         text not null,
  logo_url     text,
  created_at   timestamptz not null default now()
);

-- ============================================
-- PROJECTS (one org can have multiple projects)
-- ============================================
create table projects (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  -- Public key — safe to expose in embed code
  publishable_key text unique not null default 'pk_' || replace(gen_random_uuid()::text, '-', ''),
  -- Secret key — never exposed publicly
  secret_key      text unique not null default 'sk_' || replace(gen_random_uuid()::text, '-', ''),
  widget_version  text not null default 'latest',
  is_active       boolean not null default true,
  config          jsonb not null default '{
    "branding": {
      "primaryColor": "#6366f1",
      "secondaryColor": "#4f46e5",
      "backgroundColor": "#0f0f0f",
      "textColor": "#ffffff",
      "font": "Inter",
      "logoUrl": null,
      "position": "bottom-right",
      "theme": "dark"
    },
    "token": null,
    "chains": ["0x1", "0x2105", "0x38", "0x89", "0xa4b1", "0xa"],
    "contentBlocks": [],
    "docsUrl": null,
    "allowedDomains": []
  }'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- ============================================
-- DOCUMENTS (RAG knowledge base per project)
-- Voyage AI voyage-3 = 1024 dimensions
-- ============================================
create table documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  content     text not null,
  embedding   vector(1024),
  metadata    jsonb not null default '{}',
  source_url  text,
  created_at  timestamptz not null default now()
);

-- IVFFlat index deferred — run after 1000+ rows:
-- CREATE INDEX documents_embedding_idx ON documents
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- CONVERSATIONS
-- ============================================
create table conversations (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  wallet_address text,
  chain_id       text,
  session_id     text not null,
  created_at     timestamptz not null default now()
);

-- ============================================
-- MESSAGES
-- ============================================
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  feedback        smallint not null default 0 check (feedback in (-1, 0, 1)),
  created_at      timestamptz not null default now()
);

-- ============================================
-- RATE LIMITING
-- ============================================
create table rate_limits (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  window_start       timestamptz not null,
  conversation_count integer not null default 0,
  updated_at         timestamptz not null default now(),
  unique (project_id, window_start)
);

-- ============================================
-- DOCS INDEXING JOBS
-- ============================================
create table indexing_jobs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  source_url  text,
  status      text not null default 'pending' check (status in ('pending', 'running', 'complete', 'failed')),
  error       text,
  chunk_count integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger indexing_jobs_updated_at
  before update on indexing_jobs
  for each row execute function update_updated_at();

-- ============================================
-- INDEXES
-- ============================================
create index projects_org_id_idx on projects(org_id);
create index documents_project_id_idx on documents(project_id);
create index conversations_project_id_idx on conversations(project_id);
create index conversations_created_at_idx on conversations(created_at);
create index messages_conversation_id_idx on messages(conversation_id);
create index indexing_jobs_project_id_idx on indexing_jobs(project_id);
