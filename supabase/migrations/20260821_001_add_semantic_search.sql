create or replace function public.match_document_chunks(
  p_query_embedding extensions.vector(1536),
  p_user_id uuid,
  p_match_count integer default 5,
  p_match_threshold double precision default 0.0,
  p_document_id uuid default null
)
returns table (
  chunk_id bigint,
  document_id uuid,
  original_name text,
  chunk_index integer,
  page_number integer,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    document_chunks.id as chunk_id,
    document_chunks.document_id,
    documents.original_name,
    document_chunks.chunk_index,
    document_chunks.page_number,
    document_chunks.content,
    (
      1
      - (
        document_chunks.embedding
        operator(extensions.<=>)
        p_query_embedding
      )
    ) as similarity
  from public.document_chunks
  inner join public.documents
    on documents.id = document_chunks.document_id
  where document_chunks.user_id = p_user_id
    and documents.user_id = p_user_id
    and documents.status = 'ready'
    and document_chunks.embedding is not null
    and document_chunks.embedding_model = 'gemini-embedding-001'
    and (
      p_document_id is null
      or document_chunks.document_id = p_document_id
    )
    and (
      1
      - (
        document_chunks.embedding
        operator(extensions.<=>)
        p_query_embedding
      )
    ) >= coalesce(
      p_match_threshold,
      0.0
    )
  order by
    document_chunks.embedding
    operator(extensions.<=>)
    p_query_embedding
  limit least(
    greatest(
      coalesce(p_match_count, 5),
      1
    ),
    20
  );
$$;


revoke all
on function public.match_document_chunks(
  extensions.vector,
  uuid,
  integer,
  double precision,
  uuid
)
from public;


revoke all
on function public.match_document_chunks(
  extensions.vector,
  uuid,
  integer,
  double precision,
  uuid
)
from anon;


revoke all
on function public.match_document_chunks(
  extensions.vector,
  uuid,
  integer,
  double precision,
  uuid
)
from authenticated;


grant execute
on function public.match_document_chunks(
  extensions.vector,
  uuid,
  integer,
  double precision,
  uuid
)
to service_role;


comment on function public.match_document_chunks(
  extensions.vector,
  uuid,
  integer,
  double precision,
  uuid
)
is
  'Returns semantic chunk matches for one explicitly supplied user.';
