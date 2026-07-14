import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260714063549_ai_invoice_operations.sql'),
  'utf8',
).toLowerCase()

describe('AI invoice operations migration', () => {
  it('makes invoice issue replay idempotent under the period lock', () => {
    const functionStart = sql.indexOf('function public.issue_period_invoices')
    const periodLock = sql.indexOf('pg_advisory_xact_lock', functionStart)
    const replayLookup = sql.indexOf("audit.action = 'invoices.issued'", periodLock)
    const invoiceInsert = sql.indexOf('insert into public.invoices', replayLookup)

    expect(functionStart).toBeGreaterThanOrEqual(0)
    expect(periodLock).toBeGreaterThan(functionStart)
    expect(replayLookup).toBeGreaterThan(periodLock)
    expect(invoiceInsert).toBeGreaterThan(replayLookup)
    expect(sql).toContain("'idempotency_key', v_correlation_id")
  })

  it('keeps the active-invoice guard and restricts issue execution to service role', () => {
    expect(sql).toContain("invoice.status <> 'void'")
    expect(sql).toContain("raise exception 'invoice_already_issued'")
    expect(sql).toMatch(/revoke all on function public\.issue_period_invoices\([\s\S]+?from public, anon, authenticated/)
    expect(sql).toMatch(/grant execute on function public\.issue_period_invoices\([\s\S]+?to service_role/)
  })

  it('defines atomic versioned correction RPCs with service-only grants', () => {
    for (const functionName of [
      'void_invoice_with_audit',
      'reissue_invoice_with_audit',
      'add_invoice_adjustment_with_audit',
    ]) {
      expect(sql).toContain(`function public.${functionName}`)
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${functionName}\\([\\s\\S]+?from public, anon, authenticated`))
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${functionName}\\([\\s\\S]+?to service_role`))
    }
    expect(sql).not.toContain('security definer')
    expect(sql.match(/invoice_version_conflict/g)?.length).toBeGreaterThanOrEqual(3)
    expect(sql.match(/billing_period_locked/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('keeps every correction and its audit inside the same function transaction', () => {
    const voidStart = sql.indexOf('function public.void_invoice_with_audit')
    const voidWrite = sql.indexOf('update public.invoices', voidStart)
    const voidAudit = sql.indexOf("'invoice.voided'", voidWrite)
    expect(voidAudit).toBeGreaterThan(voidWrite)

    const reissueStart = sql.indexOf('function public.reissue_invoice_with_audit')
    const replacementWrite = sql.indexOf('insert into public.invoices', reissueStart)
    const chargesWrite = sql.indexOf('insert into public.invoice_charges', replacementWrite)
    const linkWrite = sql.indexOf('update public.invoices', chargesWrite)
    const reissueAudit = sql.indexOf("'invoice.reissued'", linkWrite)
    expect(replacementWrite).toBeGreaterThan(reissueStart)
    expect(chargesWrite).toBeGreaterThan(replacementWrite)
    expect(linkWrite).toBeGreaterThan(chargesWrite)
    expect(reissueAudit).toBeGreaterThan(linkWrite)

    const adjustmentStart = sql.indexOf('function public.add_invoice_adjustment_with_audit')
    const adjustmentCharge = sql.indexOf('insert into public.invoice_charges', adjustmentStart)
    const totalsUpdate = sql.indexOf('update public.invoices', adjustmentCharge)
    const adjustmentAudit = sql.indexOf("'invoice.adjustment_created'", totalsUpdate)
    expect(adjustmentCharge).toBeGreaterThan(adjustmentStart)
    expect(totalsUpdate).toBeGreaterThan(adjustmentCharge)
    expect(adjustmentAudit).toBeGreaterThan(totalsUpdate)
    expect(sql).not.toMatch(/dblink|http|net\./)
  })

  it('defines distributed server-only rate-limit buckets and bounded cleanup', () => {
    expect(sql).toContain('create table if not exists public.ai_rate_limit_buckets')
    expect(sql).toContain('function public.consume_ai_rate_limit')
    expect(sql).toContain('on conflict (subject_hash, scope, window_started) do update')
    expect(sql).toContain('function public.cleanup_expired_ai_rate_limits')
    expect(sql).toContain('for update skip locked')
    expect(sql).toMatch(/revoke all on table public\.ai_rate_limit_buckets from public, anon, authenticated/)
    expect(sql).toMatch(/grant execute on function public\.consume_ai_rate_limit\([\s\S]+?to service_role/)
  })
})
