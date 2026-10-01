import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('checkout billing and cash snapshots', () => {
  it('includes returned contract final period and separates cash from source allocations and refunds', () => {
    const sql = readFileSync('supabase/sql-editor/checkout-billing-report-snapshots.sql', 'utf8')
    expect(sql).toContain('h.actual_return_date between b.first_day and b.last_day')
    expect(sql).toContain('public.contract_checkout_preview(h.contract_id)')
    expect(sql).toContain("p.funding_source = 'cash'")
    expect(sql).toContain("p.funding_source <> 'cash'")
    expect(sql).toContain("'settlementAllocationTotal'")
    expect(sql).toContain("'refundTotal'")
    expect(sql).toContain('public.contract_checkout_refunds')
    expect(sql).toContain('from public, anon, authenticated')
  })
})
