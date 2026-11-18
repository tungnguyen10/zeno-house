import * as validators from '~/utils/validators/operations-report'

const buildingId = '61c5bf7c-d260-4030-9849-3c10e0339f51'
const operationId = '73b615bc-e651-4dc3-8012-aec8aad73a8d'
const version = '2026-11-02T07:15:21.123456+00:00'
const input = {
  building_id: buildingId, period_month: 11, period_year: 2026, operation_id: operationId,
  name: '  Thanh lý máy giặt  ', amount: 500000, received_date: '2026-11-02',
}

describe('building other income input boundaries', () => {
  it('defaults to the reserve fund, and normalizes the transaction reference', () => {
    expect(validators.buildingOtherIncomeCreateSchema?.parse({ ...input, transaction_reference: '  bank123  ' }))
      .toMatchObject({ name: 'Thanh lý máy giặt', allocation_target: 'reserve_fund', transaction_reference: 'BANK123' })
  })

  it.each([
    { name: ' ' }, { amount: 0 }, { amount: -10 }, { amount: 4.1 }, { amount: 1e12 },
    { received_date: '2026-11-31' }, { received_date: '2026-10-31' },
    { received_date: '2026-02-29', period_month: 2 }, { received_date: '11/2/2026' },
    { allocation_target: ['reserve_fund', 'profit'] }, { invoice_id: operationId },
    { contract_id: operationId }, { payment_id: operationId }, { operation_id: '' },
  ])('rejects invalid or billing-linked input %o', patch => {
    expect(validators.buildingOtherIncomeCreateSchema.safeParse({ ...input, ...patch }).success).toBe(false)
  })

  it('accepts leap day and a positive integer at the upper currency limit', () => {
    expect(validators.buildingOtherIncomeCreateSchema.safeParse({
      ...input, received_date: '2028-02-29', period_month: 2, period_year: 2028, amount: 999_999_999_999,
    }).success).toBe(true)
  })

  it('requires a version on edit and void, a change on edit, and a reason on void', () => {
    expect(validators.buildingOtherIncomeUpdateSchema.safeParse({ amount: 10 }).success).toBe(false)
    expect(validators.buildingOtherIncomeUpdateSchema.safeParse({ expected_updated_at: version }).success).toBe(false)
    expect(validators.buildingOtherIncomeUpdateSchema.safeParse({ expected_updated_at: version, period_year: 2028, amount: 15 }).success).toBe(false)
    expect(validators.buildingOtherIncomeUpdateSchema.parse({ expected_updated_at: version, amount: 15 })).toEqual({ expected_updated_at: version, amount: 15 })
    expect(validators.buildingOtherIncomeVoidSchema.safeParse({ void_reason: 'Sai số tiền' }).success).toBe(false)
    expect(validators.buildingOtherIncomeVoidSchema.safeParse({ expected_updated_at: version, void_reason: '  ' }).success).toBe(false)
  })
})
