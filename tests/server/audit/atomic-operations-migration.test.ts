import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260721161000_atomic_audited_operations.sql'), 'utf8')

describe('atomic audited operations migration', () => {
  it('writes shared allocation parent and child audit rows in the allocation function', () => {
    expect(sql).toContain('create or replace function public.allocate_shared_expense')
    expect(sql).toContain("'shared_expense.allocated'")
    expect(sql).toContain("'building_expense.created'")
    expect(sql).toContain('correlation_id')
    expect(sql).toContain('grant execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) to service_role')
    expect(sql).toContain('revoke execute on function public.allocate_shared_expense(uuid, integer, integer, uuid) from authenticated')
  })

  it('creates reserve-funded expenses, deductions and audit rows atomically', () => {
    expect(sql).toContain('create or replace function public.create_reserve_funded_expense_with_audit')
    expect(sql).toContain("'expense_deduction'")
    expect(sql).toContain("'building_expense.created'")
    expect(sql).toContain("'reserve_deduction'")
    expect(sql).toContain('grant execute on function public.create_reserve_funded_expense_with_audit')
  })

  it('syncs contract services and their audit rows in one transaction', () => {
    expect(sql).toContain('create or replace function public.sync_contract_services_from_building')
    expect(sql).toContain("'contract_service.synced'")
    expect(sql).toContain("'contract_service.created'")
    expect(sql).toContain("'contract_service.updated'")
    expect(sql).toContain('grant execute on function public.sync_contract_services_from_building(uuid, uuid) to service_role')
  })

  it('closes, refreshes and reopens reports with accrual and audit atomically', () => {
    expect(sql).toContain('create or replace function public.close_operations_report_with_audit')
    expect(sql).toContain('create or replace function public.refresh_reserve_accrual_with_audit')
    expect(sql).toContain('create or replace function public.reopen_operations_report_with_audit')
    expect(sql).toContain("'operations_report_period.closed'")
    expect(sql).toContain("'operations_report_period.reopened'")
    expect(sql).toContain("'reserve_fund.accrual_refreshed'")
    expect(sql).toContain("'retained_accrual_snapshot'")
    expect(sql).toContain("p_close_source = 'auto' then")
    expect(sql).toContain("message = 'Operations report is already closed'")
  })
})
