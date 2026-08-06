import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260806155944_unify_invoice_due_dates.sql'),
  'utf8',
)

describe('invoice due schedule migration', () => {
  it('renames the contract field without discarding data', () => {
    expect(sql).toMatch(/rename column payment_day to payment_due_day/i)
    expect(sql).toMatch(/p_payment_due_day smallint/i)
  })

  it('adds the immutable grace and generated overdue snapshot', () => {
    expect(sql).toMatch(/grace_period_days integer not null default 0/i)
    expect(sql).toMatch(/overdue_date date[\s\S]*generated always as \(due_date \+ grace_period_days\) stored/i)
    expect(sql).toMatch(/idx_invoices_browse_status_overdue_issued/i)
  })

  it('persists per-draft schedules and keeps transaction RPC grants explicit', () => {
    expect(sql).toMatch(/draft\.value->>'due_date'/i)
    expect(sql).toMatch(/draft\.value->>'grace_period_days'/i)
    expect(sql).toMatch(/grant execute on function public\.issue_period_invoices[\s\S]*to service_role/i)
    expect(sql).toMatch(/p_grace_period_days integer/i)
  })
})
