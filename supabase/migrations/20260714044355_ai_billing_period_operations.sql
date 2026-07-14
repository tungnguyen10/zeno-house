-- =============================================================================
-- AI billing-period operations
-- =============================================================================
-- Atomically open-or-get a monthly billing period and append its creation
-- audit exactly once. The function is server-only and SECURITY INVOKER.
-- =============================================================================

create or replace function public.open_or_get_billing_period_with_audit(
  p_building_id uuid,
  p_period_year integer,
  p_period_month integer,
  p_actor_id uuid,
  p_source text default 'api',
  p_action_plan_id uuid default null,
  p_idempotency_key uuid default null
)
returns table (
  id uuid,
  building_id uuid,
  period_year integer,
  period_month integer,
  status text,
  opened_by uuid,
  issued_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  created boolean
)
language plpgsql
set search_path = public
as $$
declare
  v_period public.billing_periods%rowtype;
  v_created boolean := false;
begin
  if p_period_year < 2000 or p_period_year > 2100 then
    raise exception 'period_year must be between 2000 and 2100';
  end if;
  if p_period_month < 1 or p_period_month > 12 then
    raise exception 'period_month must be between 1 and 12';
  end if;
  if p_source not in ('api', 'ai') then
    raise exception 'source must be api or ai';
  end if;

  insert into public.billing_periods (
    building_id,
    period_year,
    period_month,
    opened_by
  )
  values (
    p_building_id,
    p_period_year,
    p_period_month,
    p_actor_id
  )
  on conflict on constraint billing_periods_building_year_month_uq do nothing
  returning * into v_period;

  if found then
    v_created := true;
  else
    select bp.*
    into strict v_period
    from public.billing_periods bp
    where bp.building_id = p_building_id
      and bp.period_year = p_period_year
      and bp.period_month = p_period_month;
  end if;

  if v_created then
    insert into public.billing_audit_events (
      billing_period_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      after_data,
      metadata
    )
    values (
      v_period.id,
      p_actor_id,
      'period.opened',
      'billing_period',
      v_period.id,
      to_jsonb(v_period),
      jsonb_strip_nulls(jsonb_build_object(
        'building_id', v_period.building_id,
        'period_year', v_period.period_year,
        'period_month', v_period.period_month,
        'source', p_source,
        'action_plan_id', p_action_plan_id,
        'idempotency_key', p_idempotency_key
      ))
    );
  end if;

  return query
  select
    v_period.id,
    v_period.building_id,
    v_period.period_year,
    v_period.period_month,
    v_period.status,
    v_period.opened_by,
    v_period.issued_at,
    v_period.closed_at,
    v_period.created_at,
    v_period.updated_at,
    v_created;
end;
$$;

revoke all on function public.open_or_get_billing_period_with_audit(
  uuid, integer, integer, uuid, text, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.open_or_get_billing_period_with_audit(
  uuid, integer, integer, uuid, text, uuid, uuid
) to service_role;

comment on function public.open_or_get_billing_period_with_audit(
  uuid, integer, integer, uuid, text, uuid, uuid
) is 'Server-only idempotent billing period open with atomic creation audit.';

-- Verification after applying:
-- select * from public.open_or_get_billing_period_with_audit(
--   '<building-uuid>', 2026, 7, '<actor-uuid>', 'api', null, null
-- );
-- Repeat the call and verify created=false and one period.opened audit row.

-- Rollback (only while the application still supports the legacy insert path):
-- drop function if exists public.open_or_get_billing_period_with_audit(
--   uuid, integer, integer, uuid, text, uuid, uuid
-- );
