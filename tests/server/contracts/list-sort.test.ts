import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../../server/utils/db', () => ({ db: () => ({ from: mocks.from }) }))

function listQuery() {
  const row = {
    id: 'contract-2', contract_code: 'HD-2', room_id: 'room-2', tenant_id: 'tenant-2',
    building_id: 'building-1', start_date: '2026-01-01', end_date: '2027-01-01',
    monthly_rent: 3000000, deposit: 0, payment_due_day: null, occupant_count: 1,
    discount_amount: 0, surcharge_amount: 0, previous_contract_id: null,
    original_end_date: null, renewal_count: 0, status: 'active', notes: null,
    created_at: '2026-01-01', updated_at: '2026-01-01', room_number: '2',
    room_floor: 1, room_code: 'P2', room_building_id: 'building-1',
    building_name: 'Tòa A', tenant_name: 'An', tenant_phone: '0900000000',
    tenant_code: 'KH-2',
  }
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query),
    or: vi.fn(() => query), order: vi.fn(() => query),
    range: vi.fn(async () => ({ data: [row], count: 51, error: null })),
  }
  mocks.from.mockReturnValue(query)
  return query
}

describe('ContractRepository.findAll sort', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sorts buildings and rooms before page range by default', async () => {
    const query = listQuery()
    const { ContractRepository } = await import('../../../server/repositories/contracts')

    const result = await ContractRepository.findAll({} as never, {
      page: 2, limit: 20, buildingIds: ['building-1'], status: ['active'],
    })

    expect(mocks.from).toHaveBeenCalledWith('contract_browse_rows')
    expect(query.in).toHaveBeenCalledWith('building_id', ['building-1'])
    expect(query.in).toHaveBeenCalledWith('status', ['active'])
    expect(query.order.mock.calls.map(call => call[0])).toEqual([
      'building_sort_name', 'building_id', 'room_floor', 'room_sort_number',
      'room_number', 'contract_sort_code', 'contract_code', 'id',
    ])
    expect(query.range).toHaveBeenCalledWith(20, 39)
    expect(result.total).toBe(51)
    expect(result.items[0]).toMatchObject({
      contractCode: 'HD-2', room: { roomNumber: '2', floor: 1, buildingName: 'Tòa A' },
      tenant: { fullName: 'An' },
    })
  })

  it('retains explicit date sorting with an ID tie breaker', async () => {
    const query = listQuery()
    const { ContractRepository } = await import('../../../server/repositories/contracts')

    await ContractRepository.findAll({} as never, { sort: 'start_date', order: 'desc' })

    expect(query.order.mock.calls.map(call => call[0]))
      .toEqual(['start_date', 'created_at', 'id'])
  })
})
