import { validateAdjustment } from '../../../server/services/billing/rules'

describe('invoice adjustment validation', () => {
  it('blocks closed period adjustment', () => {
    expect(() => validateAdjustment({
      periodStatus: 'closed',
      invoicePaidAmount: 0,
      amount: 50_000,
      reason: 'late fee',
    })).toThrowError(expect.objectContaining({ statusCode: 409 }))
  })

  it('blocks negative adjustment exceeding paid amount', () => {
    expect(() => validateAdjustment({
      periodStatus: 'collecting',
      invoicePaidAmount: 100_000,
      amount: -150_000,
      reason: 'refund overpaid balance',
    })).toThrowError(expect.objectContaining({ statusCode: 409 }))
  })

  it('enforces reason length for significant negative adjustment', () => {
    expect(() => validateAdjustment({
      periodStatus: 'collecting',
      invoicePaidAmount: 200_000,
      amount: -100_000,
      reason: 'short',
    })).toThrowError(expect.objectContaining({ statusCode: 422 }))
  })

  it('allows positive adjustment beyond invoice total', () => {
    expect(() => validateAdjustment({
      periodStatus: 'collecting',
      invoicePaidAmount: 0,
      amount: 5_000_000,
      reason: 'additional service charge',
    })).not.toThrow()
  })
})
