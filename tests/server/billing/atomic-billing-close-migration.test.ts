import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20261105140000_atomic_billing_close.sql'),
  'utf8',
)

function functionBody(name: string): string {
  const start = sql.search(new RegExp(`create or replace function public\\.${name}\\(`, 'i'))
  expect(start, `${name} must be defined`).toBeGreaterThanOrEqual(0)
  const end = sql.indexOf('$$;', sql.indexOf('as $$', start) + 5)
  return sql.slice(start, end)
}

const closeSignature = 'public.close_billing_period_atomic(uuid, uuid, uuid, numeric, numeric, numeric, numeric)'
const reopenSignature = 'public.reopen_billing_period_atomic(uuid, uuid, text, uuid)'
const hardenedSignatures = [
  'public.issue_period_invoices(uuid, uuid, timestamptz, uuid[], jsonb, uuid)',
  'public.record_bulk_payments(uuid, jsonb, uuid)',
  'public.issue_and_pay(uuid, uuid, uuid, date, integer, timestamptz, date, text, text, jsonb, uuid)',
]

describe('atomic billing close migration', () => {
  it.each(['close_billing_period_atomic', 'reopen_billing_period_atomic'])(
    '%s is security invoker with an empty search_path',
    (name) => {
      const body = functionBody(name)
      expect(body).toMatch(/security invoker/i)
      expect(body).toContain("set search_path = ''")
    },
  )

  it.each([closeSignature, reopenSignature, ...hardenedSignatures])(
    'revokes %s from public roles and grants service_role only',
    (signature) => {
      const escaped = signature.replace(/[()[\]]/g, '\\$&')
      expect(sql).toMatch(new RegExp(`revoke all on function ${escaped}\\s+from public, anon, authenticated;`))
      expect(sql).toMatch(new RegExp(`grant execute on function ${escaped}\\s+to service_role;`))
    },
  )

  it.each([
    ['PERIOD_NOT_FOUND', 'P0002'],
    ['PERIOD_STATUS_INVALID', '23514'],
    ['PERIOD_HAS_OUTSTANDING', '23514'],
    ['PERIOD_SNAPSHOT_STALE', '40001'],
    ['PERIOD_CLOSED_INCONSISTENT', '23514'],
    ['PERIOD_NOT_CLOSED', '23514'],
    ['PERIOD_REOPEN_REASON_INVALID', '22023'],
    ['PERIOD_CLOSED_LOCKED', '23514'],
  ])('raises %s with SQLSTATE %s', (code, sqlstate) => {
    expect(sql).toMatch(new RegExp(`raise exception '${code}'[^;]*errcode = '${sqlstate}'`))
  })

  it('close locks the period, shares the operations report advisory lock and upserts the accrual', () => {
    const body = functionBody('close_billing_period_atomic')
    expect(body).toMatch(/from public\.billing_periods\s+where id = p_period_id\s+for update/)
    expect(body).toContain('pg_catalog.pg_advisory_xact_lock')
    expect(body).toContain("'operations-report:%s:%s:%s'")
    expect(body).toContain('pg_catalog.hashtextextended(')
    expect(body).toContain("on conflict (fund_id, period_year, period_month) where source = 'monthly_accrual'")
    expect(body).toContain("'skipped_report_closed'")
    expect(body).toContain("'period.closed'")
    expect(body).toContain('public.billing_audit_events')
  })

  it('close replay accepts both snake_case and camelCase closed timestamps', () => {
    const body = functionBody('close_billing_period_atomic')
    expect(body).toContain("after_data->>'closed_at'")
    expect(body).toContain("after_data->>'closedAt'")
    expect(body.indexOf("'PERIOD_CLOSED_INCONSISTENT'")).toBeGreaterThan(body.indexOf("after_data->>'closedAt'"))
  })

  it('close counts outstanding invoices like listOutstandingByPeriod', () => {
    const body = functionBody('close_billing_period_atomic')
    expect(body).toContain("invoice.status <> 'void'")
    expect(body).toContain('invoice.balance_amount > 0')
  })

  it('reopen returns to collecting, clears closed_at, audits and leaves the accrual alone', () => {
    const body = functionBody('reopen_billing_period_atomic')
    expect(body).toContain("set status = 'collecting', closed_at = null")
    expect(body).toContain("'period.reopened'")
    expect(body).not.toMatch(/reserve_fund_transactions/)
  })

  it('record_bulk_payments locks periods before the first invoice lock and keeps the closed check', () => {
    const body = functionBody('record_bulk_payments')
    expect(body).toContain('p_actor_id       uuid')
    const lock = body.search(/FROM public\.billing_periods[\s\S]*ORDER BY id\s+FOR NO KEY UPDATE/)
    const firstInvoiceLock = body.indexOf('FOR UPDATE;')
    const loop = body.indexOf('FOR v_item IN')
    expect(lock).toBeGreaterThan(-1)
    expect(lock).toBeLessThan(loop)
    expect(lock).toBeLessThan(firstInvoiceLock)
    expect(body).toContain('Kỳ đã chốt — không thể ghi nhận thanh toán mới')
  })

  it('installs billing_period_closed_guard on payments and invoices with a period share lock', () => {
    const body = functionBody('billing_period_closed_guard')
    expect(body).toMatch(/for share/i)
    expect(body).toContain("'PERIOD_CLOSED_LOCKED'")
    for (const column of [
      'status', 'subtotal_amount', 'discount_amount', 'surcharge_amount',
      'total_amount', 'paid_amount', 'balance_amount',
    ]) {
      expect(body).toContain(`new.${column} is not distinct from old.${column}`)
    }
    expect(sql).toMatch(
      /create trigger billing_period_closed_guard\s+before insert or update or delete on public\.invoice_payments/,
    )
    expect(sql).toMatch(
      /create trigger billing_period_closed_guard\s+before update on public\.invoices/,
    )
  })

  it('is one transaction', () => {
    expect(sql).toMatch(/^begin;$/m)
    expect(sql).toMatch(/^commit;$/m)
  })
})
