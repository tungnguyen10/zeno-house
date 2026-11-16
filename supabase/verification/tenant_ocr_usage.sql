-- Verification for tenant OCR usage quota (V2 PR5). Run as service_role; rolled back.
begin;

do $$
declare
  v_user uuid := (select id from auth.users order by created_at limit 1);
  v_other uuid := (select id from auth.users order by created_at desc limit 1);
  v_a uuid;
  v_b uuid;
  v_failed text;
begin
  if v_user is null then raise exception 'VERIFY: need a user'; end if;

  -- 1. Reservations count toward the user limit; the next one is refused.
  v_a := public.reserve_tenant_ocr(v_user, 100, 2, 1000000, 1000);
  v_b := public.reserve_tenant_ocr(v_user, 100, 2, 1000000, 1000);
  begin
    perform public.reserve_tenant_ocr(v_user, 100, 2, 1000000, 1000);
    raise exception 'VERIFY 1 failed: third reservation should be refused';
  exception when others then
    get stacked diagnostics v_failed = message_text;
    if v_failed <> 'TENANT_OCR_USER_LIMIT' then raise; end if;
  end;

  -- 2. Releasing frees the slot and does not count toward cost.
  perform public.release_tenant_ocr(v_a);
  perform public.reserve_tenant_ocr(v_user, 100, 2, 1000000, 1000);
  if (select cost_micro_usd from public.tenant_ocr_usage where id = v_a) <> 0 then
    raise exception 'VERIFY 2 failed: released cost must be zero';
  end if;

  -- 3. Settling replaces the reserved amount in the budget sum.
  perform public.settle_tenant_ocr(v_b, 5, 100, 10, 'verify-model');
  if (select status from public.tenant_ocr_usage where id = v_b) <> 'settled' then
    raise exception 'VERIFY 3 failed: not settled';
  end if;

  -- 4. Budget and global limits are enforced.
  begin
    perform public.reserve_tenant_ocr(v_other, 1000000, 1000, 1, 1000);
    raise exception 'VERIFY 4 failed: budget should be refused';
  exception when others then
    get stacked diagnostics v_failed = message_text;
    if v_failed <> 'TENANT_OCR_BUDGET' then raise; end if;
  end;
  begin
    perform public.reserve_tenant_ocr(v_other, 1, 1000, 100000000, 1000);
    raise exception 'VERIFY 4 failed: global limit should be refused';
  exception when others then
    get stacked diagnostics v_failed = message_text;
    if v_failed <> 'TENANT_OCR_GLOBAL_LIMIT' then raise; end if;
  end;

  raise notice 'tenant ocr usage verification passed';
end $$;

select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('reserve_tenant_ocr', 'settle_tenant_ocr', 'release_tenant_ocr');
-- Expected: false, false, true for each.

rollback;
