-- =============================================================================
-- AI agent foundation
-- =============================================================================
-- Additive objects:
--   * ai_conversations — authenticated, server-owned chat threads
--   * ai_messages      — normalized user/assistant messages
--   * ai_action_plans  — mutation previews and one-time execution lifecycle
--   * claim/cancel/complete/fail/stale lifecycle functions
--   * bounded 30-day retention cleanup
--
-- Security posture:
--   The Nuxt server uses the existing service-role repository client after
--   authenticating and authorizing the actor. RLS remains enabled as defense
--   in depth, and direct anon/authenticated table access and function execution
--   are revoked. Functions are SECURITY INVOKER (the default).
-- =============================================================================

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'completed', 'expired')),
  title text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_title_length check (title is null or char_length(title) <= 200)
);

create index if not exists idx_ai_conversations_user_updated
  on public.ai_conversations (user_id, updated_at desc);

create index if not exists idx_ai_conversations_expiry
  on public.ai_conversations (expires_at, id);

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_conversation_created
  on public.ai_messages (conversation_id, created_at, id);

create index if not exists idx_ai_messages_user_created
  on public.ai_messages (user_id, created_at desc);

create table if not exists public.ai_action_plans (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  action_type text not null check (char_length(action_type) between 1 and 120),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null check (char_length(summary) between 1 and 1000),
  normalized_payload jsonb not null,
  payload_hash text not null check (char_length(payload_hash) = 64),
  preview jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  resource_versions jsonb not null default '{}'::jsonb,
  idempotency_key uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'executing', 'succeeded', 'cancelled', 'expired', 'stale', 'failed')),
  result jsonb,
  error jsonb,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  confirmed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_action_plans_idempotency_key_unique unique (idempotency_key)
);

create index if not exists idx_ai_action_plans_user_created
  on public.ai_action_plans (user_id, created_at desc);

create index if not exists idx_ai_action_plans_conversation_created
  on public.ai_action_plans (conversation_id, created_at, id);

create index if not exists idx_ai_action_plans_pending_expiry
  on public.ai_action_plans (expires_at, id)
  where status = 'pending';

drop trigger if exists ai_action_plans_set_updated_at on public.ai_action_plans;
create trigger ai_action_plans_set_updated_at
  before update on public.ai_action_plans
  for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_action_plans enable row level security;

-- Agent state is server-only. Revoke explicit and inherited Data API access.
revoke all on table public.ai_conversations from anon, authenticated;
revoke all on table public.ai_messages from anon, authenticated;
revoke all on table public.ai_action_plans from anon, authenticated;
grant all on table public.ai_conversations to service_role;
grant all on table public.ai_messages to service_role;
grant all on table public.ai_action_plans to service_role;

create or replace function public.claim_ai_action_plan(
  p_plan_id uuid,
  p_user_id uuid
)
returns setof public.ai_action_plans
language plpgsql
set search_path = public
as $$
begin
  update public.ai_action_plans
  set status = 'expired'
  where id = p_plan_id
    and user_id = p_user_id
    and status = 'pending'
    and expires_at <= now();

  return query
  update public.ai_action_plans
  set status = 'executing',
      confirmed_at = now()
  where id = p_plan_id
    and user_id = p_user_id
    and status = 'pending'
    and expires_at > now()
  returning *;
end;
$$;

create or replace function public.cancel_ai_action_plan(
  p_plan_id uuid,
  p_user_id uuid
)
returns setof public.ai_action_plans
language sql
set search_path = public
as $$
  update public.ai_action_plans
  set status = 'cancelled'
  where id = p_plan_id
    and user_id = p_user_id
    and status = 'pending'
    and expires_at > now()
  returning *;
$$;

create or replace function public.complete_ai_action_plan(
  p_plan_id uuid,
  p_user_id uuid,
  p_result jsonb
)
returns setof public.ai_action_plans
language sql
set search_path = public
as $$
  update public.ai_action_plans
  set status = 'succeeded',
      result = coalesce(p_result, '{}'::jsonb),
      error = null,
      executed_at = now()
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
set search_path = public
as $$
  update public.ai_action_plans
  set status = 'failed',
      error = coalesce(p_error, '{}'::jsonb),
      executed_at = now()
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
set search_path = public
as $$
  update public.ai_action_plans
  set status = 'stale',
      error = coalesce(p_error, '{}'::jsonb),
      executed_at = now()
  where id = p_plan_id
    and user_id = p_user_id
    and status in ('pending', 'executing')
  returning *;
$$;

create or replace function public.cleanup_expired_ai_conversations(
  p_limit integer default 500
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit must be between 1 and 5000';
  end if;

  with expired as (
    select id
    from public.ai_conversations
    where expires_at <= now()
    order by expires_at, id
    limit p_limit
    for update skip locked
  )
  delete from public.ai_conversations c
  using expired
  where c.id = expired.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.claim_ai_action_plan(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_ai_action_plan(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_ai_action_plan(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ai_action_plan(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mark_ai_action_plan_stale(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.cleanup_expired_ai_conversations(integer) from public, anon, authenticated;

grant execute on function public.claim_ai_action_plan(uuid, uuid) to service_role;
grant execute on function public.cancel_ai_action_plan(uuid, uuid) to service_role;
grant execute on function public.complete_ai_action_plan(uuid, uuid, jsonb) to service_role;
grant execute on function public.fail_ai_action_plan(uuid, uuid, jsonb) to service_role;
grant execute on function public.mark_ai_action_plan_stale(uuid, uuid, jsonb) to service_role;
grant execute on function public.cleanup_expired_ai_conversations(integer) to service_role;

-- Verification queries (run after applying):
-- select relname, relrowsecurity from pg_class where relname like 'ai_%';
-- select grantee, table_name, privilege_type from information_schema.role_table_grants
--   where table_name like 'ai_%' and grantee in ('anon', 'authenticated');
-- select public.cleanup_expired_ai_conversations(1);

-- Rollback (only before later AI waves depend on these objects):
-- drop function if exists public.cleanup_expired_ai_conversations(integer);
-- drop function if exists public.mark_ai_action_plan_stale(uuid, uuid, jsonb);
-- drop function if exists public.fail_ai_action_plan(uuid, uuid, jsonb);
-- drop function if exists public.complete_ai_action_plan(uuid, uuid, jsonb);
-- drop function if exists public.cancel_ai_action_plan(uuid, uuid);
-- drop function if exists public.claim_ai_action_plan(uuid, uuid);
-- drop table if exists public.ai_action_plans;
-- drop table if exists public.ai_messages;
-- drop table if exists public.ai_conversations;
