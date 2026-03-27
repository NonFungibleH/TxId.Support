-- pgvector similarity search function for RAG pipeline
create or replace function match_documents (
  query_embedding  vector(1024),
  project_id       uuid,
  match_count      int     default 5,
  match_threshold  float   default 0.7
)
returns table (
  id          uuid,
  content     text,
  source_url  text,
  similarity  float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.source_url,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where
    documents.project_id = match_documents.project_id
    and documents.embedding is not null
    and 1 - (documents.embedding <=> query_embedding) >= match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
