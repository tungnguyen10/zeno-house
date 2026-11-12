import { describe, expect, it } from 'vitest'
import { contractVehicleListSchema, normalizePlate } from '~/utils/validators/contract-vehicles'
import { contractCreateSchema } from '~/utils/validators/contracts'

const U = (n: number) => `7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6${n}`
const base = {
  request_id: U(0), room_id: U(1), tenant_id: U(2), start_date: '2026-12-01', end_date: '2027-11-30',
  monthly_rent: 3_000_000, handover_electricity_reading: 1, handover_water_reading: 1,
}

describe('vehicles', () => {
  it('normalizes plates', () => {
    expect(normalizePlate('  59x1  123.45 ')).toBe('59X1 123.45')
  })

  it('rejects duplicate plates after normalization', () => {
    const r = contractVehicleListSchema.safeParse([
      { owner_name: 'A', plate_number: '59x1 12345' }, { owner_name: 'B', plate_number: '59X1  12345' },
    ])
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.path).toEqual([1, 'plate_number'])
  })

  it('caps at 10', () => {
    const list = Array.from({ length: 11 }, (_, i) => ({ owner_name: 'A', plate_number: `P${i}` }))
    expect(contractVehicleListSchema.safeParse(list).success).toBe(false)
  })
})

describe('contractCreateSchema (PR4a)', () => {
  it('requires request_id', () => {
    const { request_id: _omit, ...rest } = base
    expect(contractCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects roommate equal to primary tenant', () => {
    expect(contractCreateSchema.safeParse({ ...base, occupants: [{ tenant_id: U(2) }] }).success).toBe(false)
  })

  it('rejects duplicate roommates and duplicate service catalog ids', () => {
    expect(contractCreateSchema.safeParse({ ...base, occupants: [{ tenant_id: U(3) }, { tenant_id: U(3) }] }).success).toBe(false)
    const svc = { catalog_id: U(4), amount: 100000, quantity: 1, is_enabled: true, notes: null }
    expect(contractCreateSchema.safeParse({ ...base, services: [svc, svc] }).success).toBe(false)
  })

  it('accepts a full payload', () => {
    expect(contractCreateSchema.safeParse({
      ...base,
      occupants: [{ tenant_id: U(3), move_in_date: '2026-12-01', billing_counted: true }],
      vehicles: [{ owner_name: 'A', plate_number: '59X1 12345', vehicle_type: 'Xe máy', note: null }],
      services: [{ catalog_id: U(4), amount: 100000, quantity: 1, is_enabled: true, notes: null }],
    }).success).toBe(true)
  })
})
