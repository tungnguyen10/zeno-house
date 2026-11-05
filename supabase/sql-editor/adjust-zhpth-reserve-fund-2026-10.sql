-- One-off ledger adjustment for zhpth: closes the reserve fund at 3.982.531 at the end of 2026-10
-- (6.659.635 including the provisional 2026-11 accrual of 2.677.104), as confirmed by the owner.
-- Run as postgres. Ends with ROLLBACK by default; change the last statement to COMMIT to apply.
-- Aborts when the fund no longer holds the expected balance or the adjustment already exists.
begin;

do $$
declare
  v_building uuid;
  v_fund uuid;
  v_actor uuid := 'ab401bc4-5d7e-4e78-a9c3-d0367a3581b1';
  v_before numeric;
  v_after numeric;
  v_oct numeric;
  v_tx uuid;
begin
  select f.id, f.building_id into v_fund, v_building
  from public.reserve_funds f join public.buildings b on b.id = f.building_id
  where b.code = 'zhpth'
  for update of f;
  if v_fund is null then raise exception 'zhpth reserve fund not found'; end if;

  if exists (
    select 1 from public.reserve_fund_transactions
    where fund_id = v_fund and source = 'manual' and voided_at is null
      and note like 'Điều chỉnh đối soát chốt số T10/2026%'
  ) then
    raise exception 'Adjustment already exists, aborting';
  end if;

  select coalesce(sum(case when type = 'deposit' then amount else -amount end), 0) into v_before
  from public.reserve_fund_transactions where fund_id = v_fund and voided_at is null;
  select coalesce(sum(case when type = 'deposit' then amount else -amount end), 0) into v_oct
  from public.reserve_fund_transactions
  where fund_id = v_fund and voided_at is null and (period_year * 100 + period_month) <= 202610;
  if v_before <> 6893531 or v_oct <> 4216427 then
    raise exception 'Unexpected balance (total %, through 2026-10 %), aborting', v_before, v_oct;
  end if;

  insert into public.reserve_fund_transactions (
    fund_id, type, source, amount, date, period_year, period_month, note, created_by
  ) values (
    v_fund, 'withdrawal', 'manual', 233896, date '2026-10-31', 2026, 10,
    'Điều chỉnh đối soát chốt số T10/2026: số dư hết T10 = 3.982.531', v_actor
  ) returning id into v_tx;

  select coalesce(sum(case when type = 'deposit' then amount else -amount end), 0) into v_after
  from public.reserve_fund_transactions where fund_id = v_fund and voided_at is null;
  if v_after <> 6659635 then
    raise exception 'Unexpected balance after adjustment: %', v_after;
  end if;

  insert into public.audit_events (
    building_id, actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_building, v_actor, 'reserve_fund.adjusted', 'reserve_fund', v_fund,
    jsonb_build_object('balance', v_before, 'balance_through_2026_10', v_oct),
    jsonb_build_object('balance', v_after, 'balance_through_2026_10', v_oct - 233896),
    jsonb_build_object('transaction_id', v_tx, 'amount', 233896,
      'reason', 'Owner-confirmed closing balance for 2026-10')
  );
  raise notice 'balance % -> %, through 2026-10 % -> %', v_before, v_after, v_oct, v_oct - 233896;
end $$;

select sum(case when type = 'deposit' then amount else -amount end) filter (where (period_year * 100 + period_month) <= 202610) as balance_through_2026_10,
  sum(case when type = 'deposit' then amount else -amount end) as balance_total
from public.reserve_fund_transactions t
join public.reserve_funds f on f.id = t.fund_id
join public.buildings b on b.id = f.building_id
where b.code = 'zhpth' and t.voided_at is null;

rollback;
