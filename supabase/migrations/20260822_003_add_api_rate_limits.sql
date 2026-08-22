begin;

create table public.api_rate_limits (
    actor_key text not null,

    action text not null,

    window_started_at
        timestamp with time zone
        not null,

    request_count integer not null,

    updated_at timestamp with time zone
        not null
        default now(),

    primary key (
        actor_key,
        action
    ),

    constraint api_rate_limits_actor_key_check
        check (
            actor_key ~ '^[a-f0-9]{64}$'
        ),

    constraint api_rate_limits_action_check
        check (
            action ~ '^[a-z0-9_]{1,100}$'
        ),

    constraint api_rate_limits_count_check
        check (
            request_count >= 1
        )
);

alter table public.api_rate_limits
    enable row level security;

revoke all
on table public.api_rate_limits
from anon, authenticated;

grant all
on table public.api_rate_limits
to service_role;

create or replace function public.check_api_rate_limit(
    p_actor_key text,
    p_action text,
    p_max_requests integer,
    p_window_seconds integer
)
returns table (
    allowed boolean,
    current_count integer,
    request_limit integer,
    remaining_requests integer,
    reset_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_now timestamp with time zone;
    v_window_started_at
        timestamp with time zone;
    v_request_count integer;
    v_reset_at timestamp with time zone;
begin
    if p_actor_key
        !~ '^[a-f0-9]{64}$'
    then
        raise exception
            'Rate-limit actor key is invalid.';
    end if;

    if p_action
        !~ '^[a-z0-9_]{1,100}$'
    then
        raise exception
            'Rate-limit action is invalid.';
    end if;

    if p_max_requests
        not between 1 and 10000
    then
        raise exception
            'Rate-limit maximum is invalid.';
    end if;

    if p_window_seconds
        not between 1 and 86400
    then
        raise exception
            'Rate-limit window is invalid.';
    end if;

    v_now := clock_timestamp();

    insert into public.api_rate_limits
        as limits (
            actor_key,
            action,
            window_started_at,
            request_count,
            updated_at
        )
    values (
        p_actor_key,
        p_action,
        v_now,
        1,
        v_now
    )
    on conflict (
        actor_key,
        action
    )
    do update
    set
        window_started_at = case
            when (
                limits.window_started_at
                + make_interval(
                    secs => p_window_seconds
                )
            ) <= v_now
            then v_now
            else limits.window_started_at
        end,

        request_count = case
            when (
                limits.window_started_at
                + make_interval(
                    secs => p_window_seconds
                )
            ) <= v_now
            then 1
            else limits.request_count + 1
        end,

        updated_at = v_now
    returning
        api_rate_limits.window_started_at,
        api_rate_limits.request_count
    into
        v_window_started_at,
        v_request_count;

    v_reset_at :=
        v_window_started_at
        + make_interval(
            secs => p_window_seconds
        );

    return query
    select
        v_request_count <= p_max_requests,
        v_request_count,
        p_max_requests,
        greatest(
            p_max_requests - v_request_count,
            0
        ),
        v_reset_at;
end;
$$;

revoke all
on function public.check_api_rate_limit(
    text,
    text,
    integer,
    integer
)
from public, anon, authenticated;

grant execute
on function public.check_api_rate_limit(
    text,
    text,
    integer,
    integer
)
to service_role;

commit;
