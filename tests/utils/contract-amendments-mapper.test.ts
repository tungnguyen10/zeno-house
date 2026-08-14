import { describe, expect, it } from 'vitest'
import { mapContractAmendment, mapTenantContractAmendment } from '../../app/utils/mappers/contract-amendments'

const row = {
  id: 'amendment-1',
  contract_id: 'contract-1',
  sequence_no: 1,
  title: 'Điều chỉnh tiền thuê',
  public_content: 'Áp dụng tiền thuê mới.',
  effective_date: '2026-09-01',
  status: 'scheduled',
  changes: { monthly_rent: 5_500_000, payment_due_day: null },
  before_terms: {
    monthly_rent: 5_000_000,
    deposit: 10_000_000,
    payment_due_day: 5,
    occupant_count: 2,
    discount_amount: 0,
    surcharge_amount: 0,
  },
  after_terms: {
    monthly_rent: 5_500_000,
    deposit: 10_000_000,
    payment_due_day: null,
    occupant_count: 2,
    discount_amount: 0,
    surcharge_amount: 0,
  },
    created_by: 'user-1',
    published_by: 'user-1',
    applied_by: null,
    cancelled_by: null,
  cancellation_reason: null,
  created_at: '2026-08-14T00:00:00.000Z',
  updated_at: '2026-08-14T01:00:00.000Z',
  published_at: '2026-08-14T01:00:00.000Z',
  applied_at: null,
  cancelled_at: null,
}

describe('contract amendment mappers', () => {
  it('maps database JSON into camel-case domain terms', () => {
    expect(mapContractAmendment(row)).toMatchObject({
      id: 'amendment-1',
      contractId: 'contract-1',
      sequenceNo: 1,
      status: 'scheduled',
      changes: { monthlyRent: 5_500_000, paymentDueDay: null },
      beforeTerms: { monthlyRent: 5_000_000, paymentDueDay: 5 },
      afterTerms: { monthlyRent: 5_500_000, paymentDueDay: null },
      publishedBy: 'user-1',
    })
  })

  it('returns a tenant-safe projection without actor or cancellation fields', () => {
    const summary = mapTenantContractAmendment(row)

    expect(summary).toMatchObject({
      sequenceNo: 1,
      title: 'Điều chỉnh tiền thuê',
      publicContent: 'Áp dụng tiền thuê mới.',
      effectiveDate: '2026-09-01',
      status: 'scheduled',
    })
    expect(summary).not.toHaveProperty('createdBy')
    expect(summary).not.toHaveProperty('cancellationReason')
  })
})
