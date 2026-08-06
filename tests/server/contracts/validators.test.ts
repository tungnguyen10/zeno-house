import { describe, it, expect } from 'vitest'
import { contractCreateSchema, contractUpdateSchema } from '../../../app/utils/validators/contracts'
import { contractRenewSchema } from '../../../app/utils/validators/contract-renewals'

describe('contractCreateSchema — handover readings', () => {
  const base = {
    room_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b8e1111',
    tenant_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b8e2222',
    building_id: '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b8e3333',
    start_date: '2026-06-01',
    end_date: '2027-06-01',
    monthly_rent: 3_000_000,
    deposit: 0,
    occupant_count: 1,
    discount_amount: 0,
    surcharge_amount: 0,
    status: 'active' as const,
  }

  it('accepts a full payload with handover readings', () => {
    const result = contractCreateSchema.safeParse({
      ...base,
      handover_electricity_reading: 1250,
      handover_water_reading: 80,
      handover_reading_date: '2026-06-01',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when handover_electricity_reading is missing', () => {
    const result = contractCreateSchema.safeParse({
      ...base,
      handover_water_reading: 80,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.handover_electricity_reading).toBeDefined()
    }
  })

  it('rejects negative handover values', () => {
    const result = contractCreateSchema.safeParse({
      ...base,
      handover_electricity_reading: -5,
      handover_water_reading: 80,
    })
    expect(result.success).toBe(false)
  })

  it('allows handover_reading_date to be omitted', () => {
    const result = contractCreateSchema.safeParse({
      ...base,
      handover_electricity_reading: 0,
      handover_water_reading: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('contract due-day boundary', () => {
  const validContract = {
    room_id: '00000000-0000-4000-8000-000000000001',
    tenant_id: '00000000-0000-4000-8000-000000000002',
    start_date: '2026-08-01',
    end_date: '2027-07-31',
    monthly_rent: 3_000_000,
    handover_electricity_reading: 10,
    handover_water_reading: 20,
  }

  it('accepts payment_due_day and exposes it in parsed input', () => {
    const result = contractCreateSchema.parse({ ...validContract, payment_due_day: 5 })
    expect(result.payment_due_day).toBe(5)
  })

  it('rejects the legacy payment_day field', () => {
    expect(contractCreateSchema.safeParse({ ...validContract, payment_day: 5 }).success).toBe(false)
  })
})

describe('contractUpdateSchema strips handover fields', () => {
  it('does not surface handover fields after parsing', () => {
    const result = contractUpdateSchema.safeParse({
      notes: 'change',
      handover_electricity_reading: 999,
      handover_water_reading: 999,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('handover_electricity_reading')
      expect(result.data).not.toHaveProperty('handover_water_reading')
    }
  })
})

describe('contractRenewSchema strips handover fields', () => {
  it('renewal mode=extend ignores handover fields', () => {
    const result = contractRenewSchema.safeParse({
      mode: 'extend',
      new_end_date: '2027-06-01',
      handover_electricity_reading: 999,
      handover_water_reading: 999,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('handover_electricity_reading')
      expect(result.data).not.toHaveProperty('handover_water_reading')
    }
  })
})
