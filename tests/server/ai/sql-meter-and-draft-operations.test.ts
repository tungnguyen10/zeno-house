import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260714055623_ai_meter_and_draft_operations.sql'),
  'utf8',
).toLowerCase()

describe('AI meter and draft operation migration', () => {
  it('defines two server-only invoker RPCs', () => {
    expect(sql).toContain('function public.save_meter_readings_with_audit')
    expect(sql).toContain('function public.save_utility_usage_override_with_audit')
    expect(sql).not.toContain('security definer')
    expect(sql).toMatch(/revoke all on function public\.save_meter_readings_with_audit\([\s\S]+?from public, anon, authenticated/)
    expect(sql).toMatch(/revoke all on function public\.save_utility_usage_override_with_audit\([\s\S]+?from public, anon, authenticated/)
    expect(sql.match(/to service_role/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('locks and version-checks meter rows before a constraint upsert', () => {
    expect(sql).toContain('for update;')
    expect(sql).toContain('meter_version_conflict')
    expect(sql).toContain('on conflict on constraint meter_readings_room_type_period_unique do update')
    expect(sql).toContain('billing_period_locked')
    expect(sql).toContain('billing_invoice_locked')
  })

  it('keeps meter mutations and audits inside one database transaction', () => {
    const functionStart = sql.indexOf('function public.save_meter_readings_with_audit')
    const upsert = sql.indexOf('insert into public.meter_readings', functionStart)
    const audit = sql.indexOf('insert into public.billing_audit_events', upsert)
    expect(upsert).toBeGreaterThan(functionStart)
    expect(audit).toBeGreaterThan(upsert)
    expect(sql).not.toMatch(/dblink|http|net\./)
  })

  it('uses the same lock and version boundary for utility overrides', () => {
    expect(sql).toContain('utility_override_version_conflict')
    expect(sql).toContain('on conflict on constraint billing_utility_usages_period_room_meter_uq do update')
    expect(sql).toContain("'utility_override.saved'")
  })
})
