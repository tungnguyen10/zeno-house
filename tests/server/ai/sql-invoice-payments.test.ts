import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260803042715_add_ai_invoice_payments.sql'),
  'utf8',
).toLowerCase()

describe('AI invoice payment migration', () => {
  it('defines one invoker RPC restricted to service role', () => {
    expect(sql).toContain('function public.record_ai_invoice_payments_with_audit')
    expect(sql).toContain('security invoker')
    expect(sql).not.toContain('security definer')
    expect(sql).toMatch(/revoke all on function public\.record_ai_invoice_payments_with_audit\([\s\S]+?from public, anon, authenticated/)
    expect(sql).toMatch(/grant execute on function public\.record_ai_invoice_payments_with_audit\([\s\S]+?to service_role/)
  })

  it('checks replay before writes and stores the authoritative result', () => {
    const replay = sql.indexOf("audit.action = 'payments.ai_recorded'")
    const paymentInsert = sql.indexOf('insert into public.invoice_payments', replay)
    expect(replay).toBeGreaterThanOrEqual(0)
    expect(paymentInsert).toBeGreaterThan(replay)
    expect(sql).toContain("'payment_ids', to_jsonb(v_payment_ids)")
    expect(sql).toContain("'invoice_ids', to_jsonb(v_invoice_ids)")
    expect(sql).toContain("'total_amount', v_total_amount")
  })

  it('locks period and sorted invoices and validates the whole batch before inserts', () => {
    const periodLock = sql.indexOf('from public.billing_periods')
    const invoiceLock = sql.indexOf('from public.invoices', periodLock)
    const stableOrder = sql.indexOf('order by invoice.id', invoiceLock)
    const validateAll = sql.indexOf('ai_payment_invoice_version_conflict', stableOrder)
    const paymentInsert = sql.indexOf('insert into public.invoice_payments', validateAll)
    expect(invoiceLock).toBeGreaterThan(periodLock)
    expect(stableOrder).toBeGreaterThan(invoiceLock)
    expect(validateAll).toBeGreaterThan(stableOrder)
    expect(paymentInsert).toBeGreaterThan(validateAll)
  })

  it('derives full payment amounts from locked balances and writes child and batch audits once', () => {
    expect(sql).toMatch(/insert into public\.invoice_payments[\s\S]+?v_invoice\.balance_amount/)
    expect(sql).toContain("'invoice.payment_recorded'")
    expect(sql).toContain("'payments.ai_recorded'")
    expect(sql).toContain("set status = 'collecting'")
    expect(sql).toContain("set paid_amount = total_amount")
    expect(sql).toContain('balance_amount = 0')
  })
})
