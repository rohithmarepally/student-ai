begin;


-- =========================================================
-- ADD PROCESSING INFORMATION TO DOCUMENTS
-- =========================================================

alter table public.documents
add column if not exists page_count integer
check (
  page_count is null
  or page_count > 0
);

alter table public.documents
add column if not exists character_count integer
check (
  character_count is null
  or character_count >= 0
);

alter table public.documents
add column if not exists processed_at timestamptz;

alter table public.documents
add column if not exists processing_error text;


-- =========================================================
-- DOCUMENT CHUNKS
-- =========================================================

create table if not exists public.document_chunks (
  id bigint generated always as identity primary key,

  document_id uuid not null
    references public.documents(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  chunk_index integer not null
    check (
      chunk_index >= 0
    ),

  page_number integer not null
    check (
      page_number > 0
    ),

  content text not null
    check (
      char_length(trim(content)) > 0
    ),

  char_count integer not null
    check (
      char_count > 0
    ),

  created_at timestamptz not null
    default now(),

  unique (
    document_id,
    chunk_index
  )
);


-- Make document chunk lookups faster.
create index if not exists
document_chunks_document_id_idx
on public.document_chunks (
  document_id,
  chunk_index
);


create index if not exists
document_chunks_user_id_idx
on public.document_chunks (
  user_id
);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.document_chunks
enable row level security;


revoke all
on table public.document_chunks
from anon;


grant select
on table public.document_chunks
to authenticated;


drop policy if exists
  "Users can view their own document chunks"
on public.document_chunks;


create policy
  "Users can view their own document chunks"
on public.document_chunks
for select
to authenticated
using (
  (select auth.uid()) = user_id
);


commit;
