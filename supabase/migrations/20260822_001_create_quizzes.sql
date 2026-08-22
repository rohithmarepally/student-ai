begin;

create table public.quizzes (
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

    difficulty text not null,

    questions jsonb not null,

    question_count integer not null,

    created_at timestamp with time zone
        not null
        default now(),

    constraint quizzes_id_user_id_key
        unique (id, user_id),

    constraint quizzes_original_name_check
        check (
            char_length(original_name)
            between 1 and 255
        ),

    constraint quizzes_title_check
        check (
            char_length(title)
            between 1 and 200
        ),

    constraint quizzes_topic_check
        check (
            topic is null
            or char_length(topic)
                between 1 and 200
        ),

    constraint quizzes_difficulty_check
        check (
            difficulty in (
                'easy',
                'medium',
                'hard'
            )
        ),

    constraint quizzes_question_count_check
        check (
            question_count
            between 3 and 10
        ),

    constraint quizzes_questions_check
        check (
            case
                when jsonb_typeof(questions)
                    = 'array'
                then jsonb_array_length(questions)
                    = question_count
                else false
            end
        )
);

create table public.quiz_attempts (
    id uuid primary key
        default gen_random_uuid(),

    quiz_id uuid not null,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    answers jsonb not null,

    score integer not null,

    total integer not null,

    submitted_at timestamp with time zone
        not null
        default now(),

    constraint quiz_attempts_quiz_owner_fkey
        foreign key (quiz_id, user_id)
        references public.quizzes(id, user_id)
        on delete cascade,

    constraint quiz_attempts_score_check
        check (
            score >= 0
            and total between 3 and 10
            and score <= total
        ),

    constraint quiz_attempts_answers_check
        check (
            case
                when jsonb_typeof(answers)
                    = 'array'
                then jsonb_array_length(answers)
                    = total
                else false
            end
        )
);

create index quizzes_user_created_at_idx
    on public.quizzes (
        user_id,
        created_at desc
    );

create index quizzes_user_document_idx
    on public.quizzes (
        user_id,
        document_id
    );

create index quiz_attempts_user_quiz_idx
    on public.quiz_attempts (
        user_id,
        quiz_id,
        submitted_at desc
    );

alter table public.quizzes
    enable row level security;

alter table public.quiz_attempts
    enable row level security;

create policy
    "Users can view their own quiz metadata"
on public.quizzes
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

create policy
    "Users can view their own quiz attempts"
on public.quiz_attempts
for select
to authenticated
using (
    (select auth.uid()) = user_id
);

revoke all
on table public.quizzes
from anon, authenticated;

revoke all
on table public.quiz_attempts
from anon, authenticated;

grant all
on table public.quizzes
to service_role;

grant all
on table public.quiz_attempts
to service_role;

create or replace function public.save_generated_quiz(
    p_user_id uuid,
    p_document_id uuid,
    p_title text,
    p_topic text,
    p_difficulty text,
    p_questions jsonb
)
returns table (
    saved_quiz_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_document_name text;
    v_question_count integer;
    v_verified_questions jsonb;
    v_quiz_id uuid;
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
            'Quiz title is invalid.';
    end if;

    if p_topic is not null
       and char_length(btrim(p_topic))
            not between 1 and 200
    then
        raise exception
            'Quiz topic is invalid.';
    end if;

    if p_difficulty not in (
        'easy',
        'medium',
        'hard'
    )
    then
        raise exception
            'Quiz difficulty is invalid.';
    end if;

    if jsonb_typeof(p_questions)
        is distinct from 'array'
    then
        raise exception
            'Quiz questions must be a JSON array.';
    end if;

    v_question_count :=
        jsonb_array_length(p_questions);

    if v_question_count
        not between 3 and 10
    then
        raise exception
            'A quiz must contain between 3 and 10 questions.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(
            p_questions
        ) as item(question)
        where jsonb_typeof(item.question)
                is distinct from 'object'
           or char_length(
                btrim(
                    coalesce(
                        item.question ->> 'prompt',
                        ''
                    )
                )
            ) not between 3 and 1000
           or char_length(
                btrim(
                    coalesce(
                        item.question
                            ->> 'explanation',
                        ''
                    )
                )
            ) not between 3 and 2000
           or coalesce(
                item.question
                    ->> 'correct_option_index',
                ''
            ) !~ '^[0-3]$'
           or coalesce(
                item.question ->> 'source_id',
                ''
            ) !~ '^S[1-9][0-9]*$'
           or coalesce(
                item.question ->> 'chunk_id',
                ''
            ) !~ '^[0-9]+$'
           or coalesce(
                item.question ->> 'similarity',
                ''
            ) !~ '^(0(\.[0-9]+)?|1(\.0+)?)$'
    ) then
        raise exception
            'One or more generated questions are invalid.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(
            p_questions
        ) as item(question)
        where jsonb_typeof(
            item.question -> 'options'
        ) is distinct from 'array'
    ) then
        raise exception
            'Every question must contain an options array.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(
            p_questions
        ) as item(question)
        where jsonb_array_length(
            item.question -> 'options'
        ) <> 4
    ) then
        raise exception
            'Every question must contain four options.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(
            p_questions
        ) as item(question)
        cross join lateral jsonb_array_elements(
            item.question -> 'options'
        ) as option_value(option)
        where jsonb_typeof(option_value.option)
                is distinct from 'string'
           or char_length(
                btrim(
                    option_value.option #>> '{}'
                )
            ) not between 1 and 500
    ) then
        raise exception
            'One or more answer options are invalid.';
    end if;

    select jsonb_agg(
        jsonb_build_object(
            'id',
            extensions.gen_random_uuid()::text,

            'position',
            item.ordinality::integer,

            'prompt',
            btrim(
                item.question ->> 'prompt'
            ),

            'options',
            item.question -> 'options',

            'correct_option_index',
            (
                item.question
                    ->> 'correct_option_index'
            )::integer,

            'explanation',
            btrim(
                item.question ->> 'explanation'
            ),

            'source',
            jsonb_build_object(
                'source_id',
                btrim(
                    item.question
                        ->> 'source_id'
                ),

                'chunk_id',
                chunks.id,

                'document_id',
                documents.id,

                'original_name',
                documents.original_name,

                'page_number',
                chunks.page_number,

                'content',
                chunks.content,

                'similarity',
                (
                    item.question
                        ->> 'similarity'
                )::double precision
            )
        )
        order by item.ordinality
    )
    into v_verified_questions
    from jsonb_array_elements(
        p_questions
    ) with ordinality
        as item(question, ordinality)
    join public.document_chunks as chunks
      on chunks.id = (
            item.question ->> 'chunk_id'
         )::bigint
     and chunks.document_id = p_document_id
     and chunks.user_id = p_user_id
    join public.documents as documents
      on documents.id = chunks.document_id
     and documents.user_id = p_user_id;

    if v_verified_questions is null
       or jsonb_array_length(
            v_verified_questions
       ) <> v_question_count
    then
        raise exception
            'A quiz source could not be verified.';
    end if;

    insert into public.quizzes (
        user_id,
        document_id,
        original_name,
        title,
        topic,
        difficulty,
        questions,
        question_count
    )
    values (
        p_user_id,
        p_document_id,
        v_document_name,
        btrim(p_title),
        nullif(
            btrim(p_topic),
            ''
        ),
        p_difficulty,
        v_verified_questions,
        v_question_count
    )
    returning id
    into v_quiz_id;

    return query
    select v_quiz_id;
end;
$$;

create or replace function public.submit_quiz_attempt(
    p_user_id uuid,
    p_quiz_id uuid,
    p_answers jsonb
)
returns table (
    saved_attempt_id uuid,
    saved_score integer,
    saved_total integer,
    saved_submitted_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_questions jsonb;
    v_total integer;
    v_matched_count integer;
    v_score integer;
    v_verified_answers jsonb;
    v_attempt_id uuid;
    v_submitted_at timestamp with time zone;
begin
    select quizzes.questions
    into v_questions
    from public.quizzes as quizzes
    where quizzes.id = p_quiz_id
      and quizzes.user_id = p_user_id;

    if v_questions is null then
        raise exception
            'Quiz not found.';
    end if;

    v_total :=
        jsonb_array_length(v_questions);

    if jsonb_typeof(p_answers)
        is distinct from 'array'
       or jsonb_array_length(p_answers)
            <> v_total
    then
        raise exception
            'Every quiz question must be answered.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(
            p_answers
        ) as item(answer)
        where jsonb_typeof(item.answer)
                is distinct from 'object'
           or coalesce(
                item.answer
                    ->> 'question_id',
                ''
            ) = ''
           or coalesce(
                item.answer
                    ->> 'selected_option_index',
                ''
            ) !~ '^[0-3]$'
    ) then
        raise exception
            'One or more submitted answers are invalid.';
    end if;

    if (
        select count(
            distinct item.answer
                ->> 'question_id'
        )
        from jsonb_array_elements(
            p_answers
        ) as item(answer)
    ) <> v_total
    then
        raise exception
            'Question answers must be unique.';
    end if;

    select count(*)
    into v_matched_count
    from jsonb_array_elements(
        v_questions
    ) as question_item(question)
    join jsonb_array_elements(
        p_answers
    ) as answer_item(answer)
      on answer_item.answer
            ->> 'question_id'
       = question_item.question
            ->> 'id';

    if v_matched_count <> v_total then
        raise exception
            'Submitted question IDs do not match this quiz.';
    end if;

    select
        jsonb_agg(
            jsonb_build_object(
                'question_id',
                question_item.question
                    ->> 'id',

                'selected_option_index',
                (
                    answer_item.answer
                        ->> 'selected_option_index'
                )::integer,

                'is_correct',
                (
                    answer_item.answer
                        ->> 'selected_option_index'
                )::integer
                =
                (
                    question_item.question
                        ->> 'correct_option_index'
                )::integer
            )
            order by (
                question_item.question
                    ->> 'position'
            )::integer
        ),

        count(*) filter (
            where (
                answer_item.answer
                    ->> 'selected_option_index'
            )::integer
            =
            (
                question_item.question
                    ->> 'correct_option_index'
            )::integer
        )::integer
    into
        v_verified_answers,
        v_score
    from jsonb_array_elements(
        v_questions
    ) as question_item(question)
    join jsonb_array_elements(
        p_answers
    ) as answer_item(answer)
      on answer_item.answer
            ->> 'question_id'
       = question_item.question
            ->> 'id';

    v_attempt_id :=
        extensions.gen_random_uuid();

    v_submitted_at := now();

    insert into public.quiz_attempts (
        id,
        quiz_id,
        user_id,
        answers,
        score,
        total,
        submitted_at
    )
    values (
        v_attempt_id,
        p_quiz_id,
        p_user_id,
        v_verified_answers,
        v_score,
        v_total,
        v_submitted_at
    );

    return query
    select
        v_attempt_id,
        v_score,
        v_total,
        v_submitted_at;
end;
$$;

revoke all
on function public.save_generated_quiz(
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
)
from public, anon, authenticated;

grant execute
on function public.save_generated_quiz(
    uuid,
    uuid,
    text,
    text,
    text,
    jsonb
)
to service_role;

revoke all
on function public.submit_quiz_attempt(
    uuid,
    uuid,
    jsonb
)
from public, anon, authenticated;

grant execute
on function public.submit_quiz_attempt(
    uuid,
    uuid,
    jsonb
)
to service_role;

commit;
