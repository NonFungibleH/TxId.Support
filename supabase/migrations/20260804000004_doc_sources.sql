-- Per-page crawl state, so a re-crawl can tell what actually changed.
--
-- WHY: `crawlAndIngestCore` deleted every chunk for the pages it fetched and
-- re-embedded all of them, every time. Nothing recorded whether a page had
-- changed, so a scheduled re-crawl would re-embed an entire documentation site
-- nightly to produce near-identical vectors. Efficiency had to come before the
-- schedule, or the schedule is just a recurring bill.
--
-- With a hash and the server's own cache validators, a re-crawl skips the
-- pages that did not move and re-embeds only those that did, which is what
-- makes running it daily rather than weekly essentially free.

create table if not exists doc_sources (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  url              text not null,
  -- sha256 of the extracted text. The fallback signal, and the only one that
  -- works when a server omits or lies about its cache headers.
  content_hash     text,
  -- The server's own validators. A 304 costs almost nothing, so these are
  -- tried first and the body is never transferred when nothing changed.
  etag             text,
  last_modified    text,
  -- Separated on purpose: "we looked and it was the same" and "it changed" are
  -- different facts, and a team wants to see both. Freshness is last_checked;
  -- staleness of the content itself is last_changed.
  last_checked_at  timestamptz,
  last_changed_at  timestamptz,
  created_at       timestamptz not null default now(),
  unique (project_id, url)
);

comment on table doc_sources is
  'One row per indexed documentation page: content hash and HTTP validators, so a re-crawl only re-embeds pages that actually changed.';

create index if not exists doc_sources_project_idx on doc_sources (project_id);

alter table doc_sources enable row level security;
