begin;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  original_name text not null
    check (
      char_length(original_name) between 1 and 255
    ),

  storage_path text not null unique,

  mime_type text not null
    default 'application/pdf'
    check (
      mime_type = 'application/pdf'
    ),

  size_bytes bigint not null
    check (
      size_bytes > 0
      and size_bytes <= 10485760
    ),

  status text not null
    default 'uploaded'
    check (
      status in (
        'uploaded',
        'processing',
        'ready',
        'failed'
      )
    ),

  created_at timestamptz not null
    default now()
);

create index if not exists documents_user_created_at_idx
  on public.documents (
    user_id,
    created_at desc
  );

alter table public.documents
enable row level security;

revoke all
on table public.documents
from anon;

grant select, insert, update, delete
on table public.documents
to authenticated;



drop policy if exists
  "Users can view their own documents"
on public.documents;

create policy
  "Users can view their own documents"
on public.documents
for select
to authenticated
using (
  (select auth.uid()) = user_id
);


drop policy if exists
  "Users can create their own documents"
on public.documents;

create policy
  "Users can create their own documents"
on public.documents
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);


drop policy if exists
  "Users can update their own documents"
on public.documents;

create policy
  "Users can update their own documents"
on public.documents
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
);


drop policy if exists
  "Users can delete their own documents"
on public.documents;

create policy
  "Users can delete their own documents"
on public.documents
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);


drop policy if exists
  "Users can upload their own study documents"
on storage.objects;

create policy
  "Users can upload their own study documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'study-documents'
  and
  (storage.foldername(name))[1] =
    (select auth.uid()::text)
  and
  storage.extension(name) = 'pdf'
);


drop policy if exists
  "Users can read their own study documents"
on storage.objects;

create policy
  "Users can read their own study documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'study-documents'
  and
  (storage.foldername(name))[1] =
    (select auth.uid()::text)
);


drop policy if exists
  "Users can delete their own study documents"
on storage.objects;

create policy
  "Users can delete their own study documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'study-documents'
  and
  (storage.foldername(name))[1] =
    (select auth.uid()::text)
);

commit;
