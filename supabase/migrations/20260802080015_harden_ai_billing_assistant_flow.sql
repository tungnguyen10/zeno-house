-- AI Billing Assistant reliability and free-capacity controls.

alter table public.ai_action_plans
  add column if not exists execution_lease_until timestamptz;

update public.ai_action_plans
   set execution_lease_until = clock_timestamp()
 where status = 'executing'
   and execution_lease_until is null;

create table if not exists public.ai_provider_circuits (
  provider text primary key check (char_length(provider) between 1 and 120),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  opened_at timestamptz,
  probe_lease_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_global_daily_quotas (
  provider text not null check (char_length(provider) between 1 and 120),
  bucket_day date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (provider, bucket_day)
);

alter table public.ai_provider_circuits enable row level security;
alter table public.ai_global_daily_quotas enable row level security;

revoke all on table public.ai_provider_circuits from public, anon, authenticated;
revoke all on table public.ai_global_daily_quotas from public, anon, authenticated;
grant select, insert, update, delete on table public.ai_provider_circuits to service_role;
grant select, insert, update, delete on table public.ai_global_daily_quotas to service_role;

create or replace function public.begin_ai_chat_turn(
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text,
  p_history_limit integer,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_conversation public.ai_conversations%rowtype;
  v_message public.ai_messages%rowtype;
  v_messages jsonb;
begin
  if p_user_id is null
     or char_length(coalesce(p_content, '')) not between 1 and 8000
     or p_history_limit not between 1 and 100
     or p_expires_at <= clock_timestamp() then
    raise exception 'AI_CHAT_TURN_INPUT_INVALID' using errcode = 'P0001';
  end if;

  if p_conversation_id is null then
    insert into public.ai_conversations (user_id, status, title, expires_at)
    values (p_user_id, 'active', null, p_expires_at)
    returning * into v_conversation;
  else
    select * into v_conversation
      from public.ai_conversations
     where id = p_conversation_id
       and user_id = p_user_id
       and status = 'active'
       and expires_at > clock_timestamp()
     for update;
    if not found then return null; end if;
  end if;

  insert into public.ai_messages (conversation_id, user_id, role, content)
  values (v_conversation.id, p_user_id, 'user', p_content)
  returning * into v_message;

  update public.ai_conversations
     set expires_at = p_expires_at
   where id = v_conversation.id
     and user_id = p_user_id
  returning * into v_conversation;

  select coalesce(jsonb_agg(to_jsonb(history) order by history.created_at, history.id), '[]'::jsonb)
    into v_messages
    from (
      select *
        from public.ai_messages
       where conversation_id = v_conversation.id
         and user_id = p_user_id
       order by created_at desc, id desc
       limit p_history_limit
    ) history;

  return jsonb_build_object(
    'conversation', to_jsonb(v_conversation),
    'user_message', to_jsonb(v_message),
    'messages', v_messages
  );
end;
$$;

create or replace function public.acquire_ai_provider_request(
  p_provider text,
  p_daily_limit integer,
  p_failure_threshold integer,
  p_cooldown_ms integer,
  p_now timestamptz default clock_timestamp()
)
returns table(allowed boolean, reason text, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_circuit public.ai_provider_circuits%rowtype;
  v_count integer;
  v_cooldown interval;
begin
  if char_length(coalesce(p_provider, '')) not between 1 and 120
     or p_daily_limit < 1
     or p_failure_threshold < 1
     or p_cooldown_ms < 1000 then
    raise exception 'AI_PROVIDER_CONTROL_INPUT_INVALID' using errcode = 'P0001';
  end if;
  v_cooldown := make_interval(secs => p_cooldown_ms::double precision / 1000.0);

  insert into public.ai_provider_circuits (provider)
  values (p_provider)
  on conflict (provider) do nothing;

  select * into v_circuit
    from public.ai_provider_circuits
   where provider = p_provider
   for update;

  if v_circuit.opened_at is not null and p_now < v_circuit.opened_at + v_cooldown then
    return query select false, 'circuit_open'::text,
      greatest(ceil(extract(epoch from (v_circuit.opened_at + v_cooldown - p_now)))::integer, 1);
    return;
  end if;

  if v_circuit.opened_at is not null then
    if v_circuit.probe_lease_until is not null and v_circuit.probe_lease_until > p_now then
      return query select false, 'circuit_open'::text,
        greatest(ceil(extract(epoch from (v_circuit.probe_lease_until - p_now)))::integer, 1);
      return;
    end if;
    update public.ai_provider_circuits
       set probe_lease_until = p_now + interval '30 seconds', updated_at = p_now
     where provider = p_provider;
  end if;

  insert into public.ai_global_daily_quotas (provider, bucket_day, request_count, updated_at)
  values (p_provider, (p_now at time zone 'UTC')::date, 1, p_now)
  on conflict (provider, bucket_day) do update
    set request_count = public.ai_global_daily_quotas.request_count + 1,
        updated_at = excluded.updated_at
    where public.ai_global_daily_quotas.request_count < p_daily_limit
  returning request_count into v_count;

  if v_count is null then
    update public.ai_provider_circuits
       set probe_lease_until = null, updated_at = p_now
     where provider = p_provider;
    return query select false, 'daily_quota'::text,
      greatest(ceil(extract(epoch from (
        date_trunc('day', p_now at time zone 'UTC') + interval '1 day' - (p_now at time zone 'UTC')
      )))::integer, 1);
    return;
  end if;

  return query select true, null::text, 0;
end;
$$;

create or replace function public.record_ai_provider_outcome(
  p_provider text,
  p_succeeded boolean,
  p_failure_threshold integer,
  p_now timestamptz default clock_timestamp()
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if char_length(coalesce(p_provider, '')) not between 1 and 120 or p_failure_threshold < 1 then
    raise exception 'AI_PROVIDER_OUTCOME_INPUT_INVALID' using errcode = 'P0001';
  end if;

  insert into public.ai_provider_circuits (provider)
  values (p_provider)
  on conflict (provider) do nothing;

  if p_succeeded then
    update public.ai_provider_circuits
       set consecutive_failures = 0,
           opened_at = null,
           probe_lease_until = null,
           updated_at = p_now
     where provider = p_provider;
  else
    update public.ai_provider_circuits
       set consecutive_failures = consecutive_failures + 1,
           opened_at = case
             when consecutive_failures + 1 >= p_failure_threshold then p_now
             else opened_at
           end,
           probe_lease_until = null,
           updated_at = p_now
     where provider = p_provider;
  end if;
end;
$$;

create or replace function public.claim_ai_action_plan(
  p_plan_id uuid,
  p_user_id uuid,
  p_lease_seconds integer
)
returns setof public.ai_action_plans
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception 'AI_ACTION_LEASE_INVALID' using errcode = 'P0001';
  end if;

  update public.ai_action_plans
     set status = 'expired'
   where id = p_plan_id
     and user_id = p_user_id
     and status = 'pending'
     and expires_at <= clock_timestamp();

  return query
  update public.ai_action_plans
     set status = 'executing',
         confirmed_at = coalesce(confirmed_at, clock_timestamp()),
         execution_lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
         error = null
   where id = p_plan_id
     and user_id = p_user_id
     and expires_at > clock_timestamp()
     and (
       status = 'pending'
       or (status = 'executing' and execution_lease_until <= clock_timestamp())
     )
  returning *;
end;
$$;

create or replace function public.complete_ai_action_plan(
  p_plan_id uuid,
  p_user_id uuid,
  p_result jsonb
)
returns setof public.ai_action_plans
language sql
security invoker
set search_path = public
as $$
  update public.ai_action_plans
     set status = 'succeeded',
         result = coalesce(p_result, '{}'::jsonb),
         error = null,
         execution_lease_until = null,
         executed_at = clock_timestamp()
   where id = p_plan_id
     and user_id = p_user_id
     and status = 'executing'
  returning *;
$$;

create or replace function public.fail_ai_action_plan(
  p_plan_id uuid,
  p_user_id uuid,
  p_error jsonb
)
returns setof public.ai_action_plans
language sql
security invoker
set search_path = public
as $$
  update public.ai_action_plans
     set status = 'failed',
         error = coalesce(p_error, '{}'::jsonb),
         execution_lease_until = null,
         executed_at = clock_timestamp()
   where id = p_plan_id
     and user_id = p_user_id
     and status = 'executing'
  returning *;
$$;

create or replace function public.mark_ai_action_plan_stale(
  p_plan_id uuid,
  p_user_id uuid,
  p_error jsonb
)
returns setof public.ai_action_plans
language sql
security invoker
set search_path = public
as $$
  update public.ai_action_plans
     set status = 'stale',
         error = coalesce(p_error, '{}'::jsonb),
         execution_lease_until = null,
         executed_at = clock_timestamp()
   where id = p_plan_id
     and user_id = p_user_id
     and status in ('pending', 'executing')
  returning *;
$$;

revoke all on function public.begin_ai_chat_turn(uuid, uuid, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.acquire_ai_provider_request(text, integer, integer, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_ai_provider_outcome(text, boolean, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_ai_action_plan(uuid, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.begin_ai_chat_turn(uuid, uuid, text, integer, timestamptz)
  to service_role;
grant execute on function public.acquire_ai_provider_request(text, integer, integer, integer, timestamptz)
  to service_role;
grant execute on function public.record_ai_provider_outcome(text, boolean, integer, timestamptz)
  to service_role;
grant execute on function public.claim_ai_action_plan(uuid, uuid, integer)
  to service_role;

-- Existing lifecycle functions keep their service-role-only grants after replacement.
revoke all on function public.complete_ai_action_plan(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ai_action_plan(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mark_ai_action_plan_stale(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_ai_action_plan(uuid, uuid, jsonb) to service_role;
grant execute on function public.fail_ai_action_plan(uuid, uuid, jsonb) to service_role;
grant execute on function public.mark_ai_action_plan_stale(uuid, uuid, jsonb) to service_role;
