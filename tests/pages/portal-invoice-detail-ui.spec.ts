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

  it('puts outstanding transfer instructions before charge details', () => {
    expect(page).toContain('const showOutstandingPayment = computed')
    expect(page).toContain('mode="outstanding"')
    expect(page).toContain(':profile="invoice.invoiceProfile"')
    expect(page).toContain(':amount="invoice.balanceAmount"')
    expect(page.indexOf('mode="outstanding"')).toBeLessThan(page.indexOf('<!-- Charge breakdown -->'))
  })

  it('keeps paid payment details as read-only history after charges', () => {
    expect(page).toContain('const showPaymentHistory = computed')
    expect(page).toContain('mode="history"')
    expect(page.indexOf('mode="history"')).toBeGreaterThan(page.indexOf('<!-- Charge breakdown -->'))
  })

  it('shows void context without rendering transfer instructions for void invoices', () => {
    expect(page).toContain('const isVoid = computed')
    expect(page).toContain('Hoá đơn đã huỷ')
    expect(page).toContain('{{ invoice.voidReason ||')
    expect(page).toContain('v-if="!isVoid && showOutstandingPayment"')
    expect(page).toContain('v-if="!isVoid && showPaymentHistory"')
  })

  it('uses semantic section headings and formats all invoice dates', () => {
    expect(page).toContain('<h2 class="portal-type-heading')
    expect(page).not.toContain('<h3 class="portal-type-heading')
    expect(page).toContain('formatViDate(invoice.dueDate)')
  })
})
