begin;

create unique index
    chat_message_sources_message_chunk_key
on public.chat_message_sources (
    message_id,
    chunk_id
)
where chunk_id is not null;

create or replace function public.save_rag_exchange(
    p_user_id uuid,
    p_conversation_id uuid,
    p_document_id uuid,
    p_question text,
    p_answer text,
    p_model text,
    p_insufficient_context boolean,
    p_sources jsonb
)
returns table (
    saved_conversation_id uuid,
    saved_user_message_id uuid,
    saved_assistant_message_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_conversation_id uuid;
    v_existing_document_id uuid;
    v_user_message_id uuid;
    v_assistant_message_id uuid;
    v_user_sequence integer;
    v_assistant_sequence integer;
    v_source_count integer;
    v_inserted_source_count integer;
begin
    if p_user_id is null then
        raise exception
            'The authenticated user ID is required.';
    end if;

    if (
        p_question is null
        or char_length(btrim(p_question))
            not between 3 and 1000
    ) then
        raise exception
            'The question must contain between 3 and 1000 characters.';
    end if;

    if (
        p_answer is null
        or char_length(btrim(p_answer))
            not between 1 and 8000
    ) then
        raise exception
            'The answer must contain between 1 and 8000 characters.';
    end if;

    if (
        p_model is not null
        and char_length(btrim(p_model))
            not between 1 and 100
    ) then
        raise exception
            'The model name must contain between 1 and 100 characters.';
    end if;

    if p_insufficient_context is null then
        raise exception
            'The insufficient-context value is required.';
    end if;

    if p_sources is null then
        p_sources := '[]'::jsonb;
    end if;

    if jsonb_typeof(p_sources) <> 'array' then
        raise exception
            'Sources must be provided as a JSON array.';
    end if;

    v_source_count :=
        jsonb_array_length(p_sources);

    if v_source_count > 5 then
        raise exception
            'At most 5 sources can be saved.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(
            p_sources
        ) as source_item(value)
        where jsonb_typeof(
            source_item.value
        ) <> 'object'
    ) then
        raise exception
            'Every source must be a JSON object.';
    end if;

    if (
        p_insufficient_context
        and exists (
            select 1
            from jsonb_array_elements(
                p_sources
            ) as source_item(value)
            where coalesce(
                source_item.value ->> 'cited',
                'false'
            )::boolean
        )
    ) then
        raise exception
            'An insufficient-context answer cannot cite a source.';
    end if;

    if (
        not p_insufficient_context
        and not exists (
            select 1
            from jsonb_array_elements(
                p_sources
            ) as source_item(value)
            where coalesce(
                source_item.value ->> 'cited',
                'false'
            )::boolean
        )
    ) then
        raise exception
            'A grounded answer must cite at least one source.';
    end if;

    if (
        p_document_id is not null
        and not exists (
            select 1
            from public.documents as document
            where document.id = p_document_id
            and document.user_id = p_user_id
            and document.status = 'ready'
        )
    ) then
        raise exception
            'The selected document is unavailable.';
    end if;

    if (
        p_document_id is not null
        and exists (
            select 1
            from jsonb_array_elements(
                p_sources
            ) as source_item(value)
            where (
                source_item.value
                    ->> 'document_id'
            )::uuid
                is distinct from
                p_document_id
        )
    ) then
        raise exception
            'A source is outside the selected document.';
    end if;

    if p_conversation_id is null then
        insert into public.chat_conversations (
            user_id,
            title,
            document_id
        )
        values (
            p_user_id,
            left(
                btrim(p_question),
                120
            ),
            p_document_id
        )
        returning id
        into v_conversation_id;
    else
        select
            conversation.document_id
        into
            v_existing_document_id
        from public.chat_conversations
            as conversation
        where conversation.id =
            p_conversation_id
        and conversation.user_id =
            p_user_id
        for update;

        if not found then
            raise exception
                'The conversation was not found.';
        end if;

        if (
            v_existing_document_id
            is distinct from
            p_document_id
        ) then
            raise exception
                'The conversation document cannot be changed.';
        end if;

        v_conversation_id :=
            p_conversation_id;
    end if;

    select
        coalesce(
            max(message.sequence_number),
            0
        ) + 1
    into
        v_user_sequence
    from public.chat_messages as message
    where message.conversation_id =
        v_conversation_id;

    v_assistant_sequence :=
        v_user_sequence + 1;

    insert into public.chat_messages (
        conversation_id,
        user_id,
        sequence_number,
        role,
        content,
        model,
        insufficient_context
    )
    values (
        v_conversation_id,
        p_user_id,
        v_user_sequence,
        'user',
        btrim(p_question),
        null,
        null
    )
    returning id
    into v_user_message_id;

    insert into public.chat_messages (
        conversation_id,
        user_id,
        sequence_number,
        role,
        content,
        model,
        insufficient_context
    )
    values (
        v_conversation_id,
        p_user_id,
        v_assistant_sequence,
        'assistant',
        btrim(p_answer),
        case
            when p_model is null
                then null
            else btrim(p_model)
        end,
        p_insufficient_context
    )
    returning id
    into v_assistant_message_id;

    insert into public.chat_message_sources (
        message_id,
        user_id,
        source_id,
        chunk_id,
        document_id,
        original_name,
        page_number,
        chunk_index,
        content,
        similarity,
        cited
    )
    select
        v_assistant_message_id,
        p_user_id,
        btrim(
            source_item.value
                ->> 'source_id'
        ),
        chunk.id,
        document.id,
        document.original_name,
        chunk.page_number,
        chunk.chunk_index,
        chunk.content,
        (
            source_item.value
                ->> 'similarity'
        )::double precision,
        coalesce(
            source_item.value
                ->> 'cited',
            'false'
        )::boolean
    from jsonb_array_elements(
        p_sources
    ) as source_item(value)
    join public.document_chunks as chunk
        on chunk.id = (
            source_item.value
                ->> 'chunk_id'
        )::bigint
        and chunk.user_id = p_user_id
    join public.documents as document
        on document.id = chunk.document_id
        and document.user_id = p_user_id
        and document.id = (
            source_item.value
                ->> 'document_id'
        )::uuid;

    get diagnostics
        v_inserted_source_count =
            row_count;

    if (
        v_inserted_source_count
        <> v_source_count
    ) then
        raise exception
            'One or more sources are invalid or unavailable.';
    end if;

    update public.chat_conversations
    set updated_at = now()
    where id = v_conversation_id
    and user_id = p_user_id;

    return query
    select
        v_conversation_id,
        v_user_message_id,
        v_assistant_message_id;
end;
$function$;

revoke all
on function public.save_rag_exchange(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    boolean,
    jsonb
)
from public, anon, authenticated;

grant execute
on function public.save_rag_exchange(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    boolean,
    jsonb
)
to service_role;

comment on function public.save_rag_exchange(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    boolean,
    jsonb
) is
    'Atomically saves one authenticated RAG question, answer, and verified citation snapshots. Backend ownership checks remain required.';

commit;
