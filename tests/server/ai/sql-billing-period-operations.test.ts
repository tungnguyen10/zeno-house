import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260714044355_ai_billing_period_operations.sql'),
  'utf8',
).toLowerCase()

describe('AI billing-period operation migration', () => {
  it('defines a server-only invoker function', () => {
    expect(sql).toContain('function public.open_or_get_billing_period_with_audit')
    expect(sql).not.toContain('security definer')
    expect(sql).toMatch(/revoke all on function public\.open_or_get_billing_period_with_audit\([\s\S]+?from public, anon, authenticated/)
    expect(sql).toMatch(/grant execute on function public\.open_or_get_billing_period_with_audit\([\s\S]+?to service_role/)
  })

  it('uses the period unique constraint as the concurrency boundary', () => {
    expect(sql).toContain('on conflict on constraint billing_periods_building_year_month_uq do nothing')
    expect(sql).toContain('if found then')
    expect(sql).toContain('select bp.*')
    expect(sql).toContain('where bp.building_id = p_building_id')
  })

  it('writes one creation audit only on the successful insert path', () => {
    const createdGuard = sql.indexOf('if v_created then')
    const auditInsert = sql.indexOf('insert into public.billing_audit_events')
    expect(createdGuard).toBeGreaterThan(-1)
    expect(auditInsert).toBeGreaterThan(createdGuard)
    expect(sql).toContain("'period.opened'")
    expect(sql).toContain("'action_plan_id', p_action_plan_id")
    expect(sql).toContain("'idempotency_key', p_idempotency_key")
  })

  it('keeps period and audit in the same database transaction', () => {
    expect(sql.match(/create or replace function public\.open_or_get_billing_period_with_audit/g)).toHaveLength(1)
    expect(sql).not.toMatch(/dblink|http|net\./)
    expect(sql).not.toContain('exception when')
  })
})
