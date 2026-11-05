import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(__dirname, '../../../supabase/verification/billing_close_integrity.sql'),
  'utf8',
)
const executable = sql
  .split('\n')
  .map(line => line.replace(/--.*$/, ''))
  .join('\n')

describe('billing_close_integrity.sql', () => {
  it.each([
    'closed_periods_without_close_audit',
    'closed_periods_without_accrual_rate_positive',
    'closed_periods_without_accrual_rate_zero',
    'accruals_linked_to_non_closed_period',
    'payments_written_after_close',
    'invoices_written_after_close',
    'billing_rpc_grants',
  ])('contains the %s check', (alias) => {
    expect(executable).toContain(alias)
  })

  it('is documented as read-only', () => {
    expect(sql).toMatch(/read-only/i)
  })

  it('contains no data-changing or privilege-changing statements', () => {
    expect(executable).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i)
  })

  it('reads the grants of the five billing RPCs for every role', () => {
    for (const name of [
      'issue_period_invoices',
      'record_bulk_payments',
      'issue_and_pay',
      'close_billing_period_atomic',
      'reopen_billing_period_atomic',
    ]) {
      expect(executable).toContain(name)
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      expect(executable).toContain(`'${role}'`)
    }
  })
})
