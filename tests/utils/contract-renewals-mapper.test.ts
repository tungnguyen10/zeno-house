import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Tables } from '../../app/types/database.types'
import { mapContractRenewal } from '../../app/utils/mappers/contract-renewals'

describe('mapContractRenewal', () => {
  it('preserves a missing historical actor after the auth user is deleted', () => {
    const row: Tables<'contract_renewals'> = {
      id: 'renewal-1',
      contract_id: 'contract-1',
      new_contract_id: null,
      mode: 'extend',
      old_end_date: '2026-07-31',
      new_end_date: '2027-07-31',
      old_monthly_rent: 5_000_000,
      new_monthly_rent: 5_000_000,
      reason: null,
      created_by: null,
      created_at: '2026-07-01T00:00:00.000Z',
    }

    const renewal = mapContractRenewal(row)

    expect(renewal.createdBy).toBeNull()
    expectTypeOf(renewal.createdBy).toEqualTypeOf<string | null>()
  })
})
