begin;

create table public.chat_conversations (
    id uuid
        primary key
        default gen_random_uuid(),

    user_id uuid
        not null
        references auth.users(id)
        on delete cascade,

    title text
        not null
        default 'New conversation',

    document_id uuid
        references public.documents(id)
        on delete set null,

    created_at timestamp with time zone
        not null
        default now(),

    updated_at timestamp with time zone
        not null
        default now(),

    constraint chat_conversations_title_check
        check (
            char_length(btrim(title))
            between 1 and 120
        ),

    constraint chat_conversations_updated_at_check
        check (
            updated_at >= created_at
        ),

    constraint chat_conversations_id_user_id_key
        unique (id, user_id)
);

create table public.chat_messages (
    id uuid
        primary key
        default gen_random_uuid(),

    conversation_id uuid
        not null,

    user_id uuid
        not null,

    sequence_number integer
        not null,

    role text
        not null,

    content text
        not null,

    model text,

    insufficient_context boolean,

    created_at timestamp with time zone
        not null
        default now(),

    constraint chat_messages_conversation_owner_fkey
        foreign key (
            conversation_id,
            user_id
        )
        references public.chat_conversations (
            id,
            user_id
        )
        on delete cascade,

    constraint chat_messages_id_user_id_key
        unique (id, user_id),

    constraint chat_messages_conversation_sequence_key
        unique (
            conversation_id,
            sequence_number
        ),

    constraint chat_messages_sequence_number_check
        check (
            sequence_number > 0
        ),

    constraint chat_messages_role_check
        check (
            role in (
                'user',
                'assistant'
            )
        ),

    constraint chat_messages_content_check
        check (
            char_length(btrim(content)) > 0
            and (
                (
                    role = 'user'
                    and char_length(content) <= 1000
                )
                or
                (
                    role = 'assistant'
                    and char_length(content) <= 8000
                )
            )
        ),

    constraint chat_messages_model_length_check
        check (
            model is null
            or char_length(model)
                between 1 and 100
        ),

    constraint chat_messages_role_metadata_check
        check (
            (
                role = 'user'
                and model is null
                and insufficient_context is null
            )
            or
            (
                role = 'assistant'
                and insufficient_context is not null
            )
        )
);

create table public.chat_message_sources (
    id bigint
        generated always as identity
        primary key,

    message_id uuid
        not null,

    user_id uuid
        not null,

    source_id text
        not null,

    chunk_id bigint
        references public.document_chunks(id)
        on delete set null,

    document_id uuid
        references public.documents(id)
        on delete set null,

    original_name text
        not null,

    page_number integer
        not null,

    chunk_index integer
        not null,

    content text
        not null,

    similarity double precision
        not null,

    cited boolean
        not null
        default false,

    created_at timestamp with time zone
        not null
        default now(),

    constraint chat_message_sources_message_owner_fkey
        foreign key (
            message_id,
            user_id
        )
        references public.chat_messages (
            id,
            user_id
        )
        on delete cascade,

    constraint chat_message_sources_message_source_key
        unique (
            message_id,
            source_id
        ),

    constraint chat_message_sources_source_id_check
        check (
            source_id ~ '^S[1-9][0-9]*$'
        ),

    constraint chat_message_sources_original_name_check
        check (
            char_length(original_name)
            between 1 and 255
        ),

    constraint chat_message_sources_page_number_check
        check (
            page_number > 0
        ),

    constraint chat_message_sources_chunk_index_check
        check (
            chunk_index >= 0
        ),

    constraint chat_message_sources_content_check
        check (
            char_length(btrim(content))
            between 1 and 4000
        ),

    constraint chat_message_sources_similarity_check
        check (
            similarity >= 0
            and similarity <= 1
        )
);

create index chat_conversations_user_updated_at_idx
    on public.chat_conversations (
        user_id,
        updated_at desc
    );

create index chat_messages_user_id_idx
    on public.chat_messages (
        user_id
    );

create index chat_message_sources_user_id_idx
    on public.chat_message_sources (
        user_id
    );

alter table public.chat_conversations
    enable row level security;

alter table public.chat_messages
    enable row level security;

alter table public.chat_message_sources
    enable row level security;

create policy
    "Users can view their own chat conversations"
on public.chat_conversations
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

create policy
    "Users can view their own chat messages"
on public.chat_messages
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

create policy
    "Users can view their own chat message sources"
on public.chat_message_sources
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

revoke all
on table public.chat_conversations
from anon, authenticated;

revoke all
on table public.chat_messages
from anon, authenticated;

revoke all
on table public.chat_message_sources
from anon, authenticated;

grant select
on table public.chat_conversations
to authenticated;

grant select
on table public.chat_messages
to authenticated;

grant select
on table public.chat_message_sources
to authenticated;

grant all
on table public.chat_conversations
to service_role;

grant all
on table public.chat_messages
to service_role;

grant all
on table public.chat_message_sources
to service_role;

revoke all
on sequence public.chat_message_sources_id_seq
from anon, authenticated;

grant all
on sequence public.chat_message_sources_id_seq
to service_role;

comment on table public.chat_conversations is
    'User-owned persistent RAG conversations.';

comment on table public.chat_messages is
    'Ordered user and assistant messages within conversations.';

comment on table public.chat_message_sources is
    'Citation snapshots saved with assistant messages.';

comment on column public.chat_conversations.document_id is
    'Optional PDF scope selected for the conversation. Backend ownership validation is required.';

comment on column public.chat_messages.sequence_number is
    'Deterministic message order within one conversation.';

comment on column public.chat_message_sources.content is
    'Snapshot of retrieved chunk content so citation history survives later document deletion.';

commit;
