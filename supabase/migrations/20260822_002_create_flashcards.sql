begin;

create table public.flashcard_decks (
    id uuid primary key
        default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    document_id uuid
        references public.documents(id)
        on delete set null,

    original_name text not null,

    title text not null,

    topic text,

    card_count integer not null,

    created_at timestamp with time zone
        not null
        default now(),

    constraint flashcard_decks_id_user_id_key
        unique (id, user_id),

    constraint flashcard_decks_original_name_check
        check (
            char_length(original_name)
            between 1 and 255
        ),

    constraint flashcard_decks_title_check
        check (
            char_length(title)
            between 1 and 200
        ),

    constraint flashcard_decks_topic_check
        check (
            topic is null
            or char_length(topic)
                between 1 and 200
        ),

    constraint flashcard_decks_card_count_check
        check (
            card_count
            between 5 and 20
        )
);

create table public.flashcards (
    id uuid primary key
        default gen_random_uuid(),

    deck_id uuid not null,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    position integer not null,

    front text not null,

    back text not null,

    source_id text not null,

    source_chunk_id bigint not null,

    source_document_id uuid not null,

    source_original_name text not null,

    source_page_number integer not null,

    source_content text not null,

    similarity double precision not null,

    due_at timestamp with time zone
        not null
        default now(),

    interval_days integer not null
        default 0,

    correct_streak integer not null
        default 0,

    review_count integer not null
        default 0,

    last_reviewed_at timestamp with time zone,

    created_at timestamp with time zone
        not null
        default now(),

    constraint flashcards_deck_owner_fkey
        foreign key (deck_id, user_id)
        references public.flashcard_decks(
            id,
            user_id
        )
        on delete cascade,

    constraint flashcards_id_user_id_key
        unique (id, user_id),

    constraint flashcards_deck_position_key
        unique (deck_id, position),

    constraint flashcards_position_check
        check (position > 0),

    constraint flashcards_front_check
        check (
            char_length(front)
            between 1 and 1000
        ),

    constraint flashcards_back_check
        check (
            char_length(back)
            between 1 and 3000
        ),

    constraint flashcards_source_id_check
        check (
            source_id ~ '^S[1-9][0-9]*$'
        ),

    constraint flashcards_source_page_check
        check (source_page_number > 0),

    constraint flashcards_source_content_check
        check (
            char_length(source_content) > 0
        ),

    constraint flashcards_similarity_check
        check (
            similarity
            between 0.0 and 1.0
        ),

    constraint flashcards_interval_check
        check (
            interval_days
            between 0 and 365
        ),

    constraint flashcards_correct_streak_check
        check (correct_streak >= 0),

    constraint flashcards_review_count_check
        check (review_count >= 0)
);

create table public.flashcard_reviews (
    id uuid primary key
        default gen_random_uuid(),

    card_id uuid not null,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    rating text not null,

    previous_due_at timestamp with time zone
        not null,

    next_due_at timestamp with time zone
        not null,

    interval_days integer not null,

    reviewed_at timestamp with time zone
        not null
        default now(),

    constraint flashcard_reviews_card_owner_fkey
        foreign key (card_id, user_id)
        references public.flashcards(
            id,
            user_id
        )
        on delete cascade,

    constraint flashcard_reviews_rating_check
        check (
            rating in (
                'again',
                'hard',
                'good',
                'easy'
            )
        ),

    constraint flashcard_reviews_interval_check
        check (
            interval_days
            between 0 and 365
        )
);

create index flashcard_decks_user_created_idx
    on public.flashcard_decks (
        user_id,
        created_at desc
    );

create index flashcards_user_due_idx
    on public.flashcards (
        user_id,
        due_at
    );

create index flashcards_deck_position_idx
    on public.flashcards (
        deck_id,
        position
    );

create index flashcard_reviews_user_card_idx
    on public.flashcard_reviews (
        user_id,
        card_id,
        reviewed_at desc
    );

alter table public.flashcard_decks
    enable row level security;

alter table public.flashcards
    enable row level security;

alter table public.flashcard_reviews
    enable row level security;

create policy
    "Users can view their own flashcard decks"
on public.flashcard_decks
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

create policy
    "Users can view their own flashcards"
on public.flashcards
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

create policy
    "Users can view their own flashcard reviews"
on public.flashcard_reviews
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

revoke all
on table public.flashcard_decks
from anon, authenticated;

revoke all
on table public.flashcards
from anon, authenticated;

revoke all
on table public.flashcard_reviews
from anon, authenticated;

grant all
on table public.flashcard_decks
to service_role;

grant all
on table public.flashcards
to service_role;

grant all
on table public.flashcard_reviews
to service_role;

create or replace function public.save_generated_flashcard_deck(
    p_user_id uuid,
    p_document_id uuid,
    p_title text,
    p_topic text,
    p_cards jsonb
)
returns table (
    saved_deck_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_document_name text;
    v_card_count integer;
    v_deck_id uuid;
    v_saved_count integer;
begin
    select documents.original_name
    into v_document_name
    from public.documents as documents
    where documents.id = p_document_id
      and documents.user_id = p_user_id
      and documents.status = 'ready';

    if v_document_name is null then
        raise exception
            'The document is unavailable or not ready.';
    end if;

    if char_length(btrim(p_title))
        not between 1 and 200
    then
        raise exception
            'Flashcard deck title is invalid.';
    end if;

    if p_topic is not null
       and char_length(btrim(p_topic))
            not between 1 and 200
    then
        raise exception
            'Flashcard deck topic is invalid.';
    end if;

    if jsonb_typeof(p_cards)
        is distinct from 'array'
    then
        raise exception
            'Flashcards must be a JSON array.';
    end if;

    v_card_count :=
        jsonb_array_length(p_cards);

    if v_card_count
        not between 5 and 20
    then
        raise exception
            'A deck must contain between 5 and 20 cards.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(
            p_cards
        ) as item(card)
        where jsonb_typeof(item.card)
                is distinct from 'object'
           or char_length(
                btrim(
                    coalesce(
                        item.card ->> 'front',
                        ''
                    )
                )
            ) not between 1 and 1000
           or char_length(
                btrim(
                    coalesce(
                        item.card ->> 'back',
                        ''
                    )
                )
            ) not between 1 and 3000
           or coalesce(
                item.card ->> 'source_id',
                ''
            ) !~ '^S[1-9][0-9]*$'
           or coalesce(
                item.card ->> 'chunk_id',
                ''
            ) !~ '^[0-9]+$'
           or coalesce(
                item.card ->> 'similarity',
                ''
            ) !~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
    ) then
        raise exception
            'One or more flashcards are invalid.';
    end if;

    v_deck_id :=
        extensions.gen_random_uuid();

    insert into public.flashcard_decks (
        id,
        user_id,
        document_id,
        original_name,
        title,
        topic,
        card_count
    )
    values (
        v_deck_id,
        p_user_id,
        p_document_id,
        v_document_name,
        btrim(p_title),
        nullif(
            btrim(p_topic),
            ''
        ),
        v_card_count
    );

    insert into public.flashcards (
        id,
        deck_id,
        user_id,
        position,
        front,
        back,
        source_id,
        source_chunk_id,
        source_document_id,
        source_original_name,
        source_page_number,
        source_content,
        similarity
    )
    select
        extensions.gen_random_uuid(),
        v_deck_id,
        p_user_id,
        item.ordinality::integer,
        btrim(item.card ->> 'front'),
        btrim(item.card ->> 'back'),
        btrim(item.card ->> 'source_id'),
        chunks.id,
        documents.id,
        documents.original_name,
        chunks.page_number,
        chunks.content,
        (
            item.card ->> 'similarity'
        )::double precision
    from jsonb_array_elements(
        p_cards
    ) with ordinality
        as item(card, ordinality)
    join public.document_chunks as chunks
      on chunks.id = (
            item.card ->> 'chunk_id'
         )::bigint
     and chunks.document_id = p_document_id
     and chunks.user_id = p_user_id
    join public.documents as documents
      on documents.id = chunks.document_id
     and documents.user_id = p_user_id;

    get diagnostics
        v_saved_count = row_count;

    if v_saved_count <> v_card_count then
        raise exception
            'A flashcard source could not be verified.';
    end if;

    return query
    select v_deck_id;
end;
$$;

create or replace function public.review_flashcard(
    p_user_id uuid,
    p_card_id uuid,
    p_rating text
)
returns table (
    reviewed_card_id uuid,
    reviewed_deck_id uuid,
    next_due_at timestamp with time zone,
    new_interval_days integer,
    new_review_count integer,
    new_correct_streak integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_deck_id uuid;
    v_previous_due_at timestamp with time zone;
    v_previous_interval integer;
    v_previous_streak integer;
    v_previous_review_count integer;
    v_reviewed_at timestamp with time zone;
    v_next_due_at timestamp with time zone;
    v_new_interval integer;
    v_new_streak integer;
    v_new_review_count integer;
begin
    if p_rating not in (
        'again',
        'hard',
        'good',
        'easy'
    ) then
        raise exception
            'Flashcard rating is invalid.';
    end if;

    select
        cards.deck_id,
        cards.due_at,
        cards.interval_days,
        cards.correct_streak,
        cards.review_count
    into
        v_deck_id,
        v_previous_due_at,
        v_previous_interval,
        v_previous_streak,
        v_previous_review_count
    from public.flashcards as cards
    where cards.id = p_card_id
      and cards.user_id = p_user_id
    for update;

    if v_deck_id is null then
        raise exception
            'Flashcard not found.';
    end if;

    v_reviewed_at := now();
    v_new_review_count :=
        v_previous_review_count + 1;

    case p_rating
        when 'again' then
            v_new_interval := 0;
            v_new_streak := 0;
            v_next_due_at :=
                v_reviewed_at
                + interval '10 minutes';

        when 'hard' then
            v_new_interval :=
                least(
                    365,
                    greatest(
                        1,
                        ceil(
                            greatest(
                                v_previous_interval,
                                1
                            ) * 1.2
                        )::integer
                    )
                );

            v_new_streak := 0;

            v_next_due_at :=
                v_reviewed_at
                + make_interval(
                    days => v_new_interval
                );

        when 'good' then
            v_new_interval :=
                least(
                    365,
                    case
                        when v_previous_interval < 1
                            then 2
                        else ceil(
                            v_previous_interval * 2.0
                        )::integer
                    end
                );

            v_new_streak :=
                v_previous_streak + 1;

            v_next_due_at :=
                v_reviewed_at
                + make_interval(
                    days => v_new_interval
                );

        when 'easy' then
            v_new_interval :=
                least(
                    365,
                    case
                        when v_previous_interval < 1
                            then 4
                        else ceil(
                            v_previous_interval * 3.0
                        )::integer
                    end
                );

            v_new_streak :=
                v_previous_streak + 1;

            v_next_due_at :=
                v_reviewed_at
                + make_interval(
                    days => v_new_interval
                );
    end case;

    update public.flashcards
    set
        due_at = v_next_due_at,
        interval_days = v_new_interval,
        correct_streak = v_new_streak,
        review_count = v_new_review_count,
        last_reviewed_at = v_reviewed_at
    where id = p_card_id
      and user_id = p_user_id;

    insert into public.flashcard_reviews (
        card_id,
        user_id,
        rating,
        previous_due_at,
        next_due_at,
        interval_days,
        reviewed_at
    )
    values (
        p_card_id,
        p_user_id,
        p_rating,
        v_previous_due_at,
        v_next_due_at,
        v_new_interval,
        v_reviewed_at
    );

    return query
    select
        p_card_id,
        v_deck_id,
        v_next_due_at,
        v_new_interval,
        v_new_review_count,
        v_new_streak;
end;
$$;

revoke all
on function public.save_generated_flashcard_deck(
    uuid,
    uuid,
    text,
    text,
    jsonb
)
from public, anon, authenticated;

grant execute
on function public.save_generated_flashcard_deck(
    uuid,
    uuid,
    text,
    text,
    jsonb
)
to service_role;

revoke all
on function public.review_flashcard(
    uuid,
    uuid,
    text
)
from public, anon, authenticated;

grant execute
on function public.review_flashcard(
    uuid,
    uuid,
    text
)
to service_role;

commit;
