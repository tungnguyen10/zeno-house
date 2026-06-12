import { calculateInvoicePaymentStatus } from '../../../server/services/billing/rules'
import { buildInvoice } from '../../__fixtures__/billing/invoice'

describe('invoice status rules', () => {
  it('moves payment accumulation to paid', () => {
    const invoice = buildInvoice({ totalAmount: 1_000_000, paidAmount: 400_000, status: 'partial' })

    expect(calculateInvoicePaymentStatus(invoice, 600_000)).toMatchObject({
      paidAmount: 1_000_000,
      balanceAmount: 0,
      status: 'paid',
    })
  })

  it('keeps partial when payment does not settle invoice', () => {
    const invoice = buildInvoice({ totalAmount: 1_000_000, paidAmount: 0, status: 'issued' })

    expect(calculateInvoicePaymentStatus(invoice, 250_000)).toMatchObject({
      paidAmount: 250_000,
      balanceAmount: 750_000,
      status: 'partial',
    })
  })

  it('captures void and reissue link rules in fixture shape', () => {
    const voided = buildInvoice({ status: 'void', paidAmount: 0, voidReason: 'wrong readings' })
    const replacement = buildInvoice({ id: 'invoice-2', supersedesInvoiceId: voided.id })

    expect(voided.status).toBe('void')
    expect(voided.paidAmount).toBe(0)
    expect(replacement.supersedesInvoiceId).toBe(voided.id)
  })
})
