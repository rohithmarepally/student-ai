begin;

create extension if not exists vector
with schema extensions;

alter table public.document_chunks
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text,
  add column if not exists embedded_at timestamp with time zone;

do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.document_chunks'::regclass
      and conname = 'document_chunks_embedding_metadata_check'
  ) then
    alter table public.document_chunks
      add constraint document_chunks_embedding_metadata_check
      check (
        (
          embedding is null
          and embedding_model is null
          and embedded_at is null
        )
        or
        (
          embedding is not null
          and embedding_model is not null
          and embedded_at is not null
        )
      );
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.document_chunks'::regclass
      and conname = 'document_chunks_embedding_model_length_check'
  ) then
    alter table public.document_chunks
      add constraint document_chunks_embedding_model_length_check
      check (
        embedding_model is null
        or char_length(embedding_model) between 1 and 100
      );
  end if;
end
$migration$;

create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

comment on column public.document_chunks.embedding is
  'Semantic embedding generated from the chunk content.';

comment on column public.document_chunks.embedding_model is
  'Embedding model used to generate the semantic embedding.';

comment on column public.document_chunks.embedded_at is
  'Time at which the semantic embedding was generated.';

commit;
