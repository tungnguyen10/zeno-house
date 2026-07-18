import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve('app/pages/portal/invoices/[id].vue'), 'utf8')

describe('portal invoice detail refreshed UI', () => {
  it('uses a status-accented statement summary with a distinct currency unit', () => {
    expect(page).toContain(':accent="portalInvoiceStatementAccent(invoice.status)"')
    expect(page).toContain('formatCurrencyNumber(invoice.balanceAmount)')
    expect(page).toContain('class="portal-money-unit"')
    expect(page).toContain('PortalStatusBadge')
  })

  it('renders payment totals and charges as divider-led rows instead of group cards', () => {
    expect(page).toContain('<dl class="divide-y divide-border-light')
    expect(page).toContain('Đã thanh toán')
    expect(page).toContain('<section v-for="group in chargeGroups"')
    expect(page).not.toContain('<PortalCard v-for="group in chargeGroups"')
  })

  it('matches loading placeholders to the statement and breakdown', () => {
    expect(page).toContain('variant="statement"')
    expect(page).toContain('variant="card"')
  })
})
