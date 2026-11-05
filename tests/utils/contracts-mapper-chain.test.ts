import { describe, expect, it } from 'vitest'
import type { Tables } from '../../app/types/database.types'
import { mapContractWithDetails } from '../../app/utils/mappers/contracts'

const row: Tables<'contracts'> = {
  id: 'contract-2', contract_code: 'HD-2', room_id: 'room-1', tenant_id: 'tenant-1',
  building_id: 'building-1', start_date: '2026-01-01', end_date: '2027-01-01',
  monthly_rent: 3000000, deposit: 0, payment_due_day: null, occupant_count: 1,
  discount_amount: 0, surcharge_amount: 0, previous_contract_id: 'contract-1',
  original_end_date: null, renewal_count: 0, status: 'renewed', notes: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
}

describe('contract detail renewal chain mapper', () => {
  it('maps previous and successor IDs and canonical contract codes', () => {
    const result = mapContractWithDetails({
      ...row, rooms: null, tenants: null,
      previous_contract: { id: 'contract-1', contract_code: 'HD-1' },
      successor: { id: 'contract-3', contract_code: 'HD-3' },
    })
    expect(result).toMatchObject({
      previousContract: { id: 'contract-1', code: 'HD-1' },
      successorContract: { id: 'contract-3', code: 'HD-3' },
    })
  })

  it.each([undefined, null])('normalizes absent relations (%s) to null', (relation) => {
    const result = mapContractWithDetails({
      ...row, rooms: null, tenants: null, previous_contract: relation, successor: relation,
    })
    expect(result).toMatchObject({ previousContract: null, successorContract: null })
  })
})
