-- All portal business data is resolved and whitelisted by Nuxt services.
-- Retain RLS as defense in depth; remove unused direct browser-role access.
begin;

do $$
declare
  v_table text;
  v_columns text;
begin
  foreach v_table in array array['contracts', 'contract_occupants', 'invoices'] loop
    execute pg_catalog.format('revoke select on table public.%I from public, anon, authenticated', v_table);
    -- Remove legacy column grants as well as the table-level grant.
    select pg_catalog.string_agg(pg_catalog.format('%I', attname), ', ' order by attnum)
      into v_columns
    from pg_catalog.pg_attribute
    where attrelid = pg_catalog.to_regclass('public.' || v_table)
      and attnum > 0 and not attisdropped;
    execute pg_catalog.format('revoke select (%s) on public.%I from public, anon, authenticated', v_columns, v_table);
    execute pg_catalog.format('grant select on table public.%I to service_role', v_table);
  end loop;
end;
$$;

-- The previous direct INSERT policy depended on contract SELECT. Request writes
-- already use service_role after live account, housing and payload validation;
-- close the unused direct write route instead of preserving that dependency.
revoke insert, update, delete on public.support_requests from public, anon, authenticated;
do $$
declare
  v_columns text;
begin
  select pg_catalog.string_agg(pg_catalog.format('%I', attname), ', ' order by attnum)
    into v_columns
  from pg_catalog.pg_attribute
  where attrelid = 'public.support_requests'::regclass
    and attnum > 0 and not attisdropped;
  execute pg_catalog.format('revoke insert (%s), update (%s) on public.support_requests from public, anon, authenticated', v_columns, v_columns);
end;
$$;
grant select, insert, update, delete on public.support_requests to service_role;

notify pgrst, 'reload schema';
commit;

-- Rollback is an explicitly reviewed grant restoration. Do not automatically
-- re-expose internal contract notes or permit writes outside server validation.
