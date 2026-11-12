import { describe, expect, it } from 'vitest'
import { buildingContractProfileSchema } from '~/utils/validators/building-contract-profile'

const full = {
  lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02', lessor_permanent_address: '12 Lê Lợi, Huế',
  lessor_id_number: '012345678901', lessor_id_issued_date: '2021-05-01', lessor_id_issued_place: 'Cục Cảnh sát QLHC về TTXH',
  lessor_phone: '0901 234 567', brand_name: 'Zeno House', default_term_months: 12, default_deposit_months: 1.5,
  notice_days: 30, deposit_refund_days: 7, renewal_months: 6, extra_occupant_fee: 500000, drilling_fee: 50000,
  fingerprint_reset_fee: 100000, signed_copies: 2, copies_per_party: 1,
}

describe('buildingContractProfileSchema', () => {
  it('accepts a full profile and normalizes phone', () => {
    const r = buildingContractProfileSchema.safeParse(full)
    expect(r.success).toBe(true)
    expect(r.data!.lessor_phone).toBe('0901234567')
  })

  it('accepts an empty profile (all nullable, copies default)', () => {
    const r = buildingContractProfileSchema.safeParse({})
    expect(r.success).toBe(true)
    expect(r.data).toMatchObject({ lessor_full_name: null, signed_copies: 2, copies_per_party: 1 })
  })

  it('converts empty strings to null', () => {
    const r = buildingContractProfileSchema.safeParse({ lessor_full_name: '  ', lessor_id_number: '' })
    expect(r.data).toMatchObject({ lessor_full_name: null, lessor_id_number: null })
  })

  it.each(['12345', '0123456789012', '01234567890A'])('rejects id number %s without echoing it', (bad) => {
    const r = buildingContractProfileSchema.safeParse({ lessor_id_number: bad })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error!.issues)).not.toContain(bad)
  })

  it('accepts 9-digit legacy CMND', () => {
    expect(buildingContractProfileSchema.safeParse({ lessor_id_number: '123456789' }).success).toBe(true)
  })

  it('rejects id issued date in the future', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    expect(buildingContractProfileSchema.safeParse({ lessor_id_issued_date: tomorrow }).success).toBe(false)
  })

  it('enforces copies_per_party * 2 <= signed_copies', () => {
    const r = buildingContractProfileSchema.safeParse({ signed_copies: 1, copies_per_party: 1 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.path).toEqual(['copies_per_party'])
  })

  it.each([
    ['default_term_months', 0], ['default_term_months', 61], ['default_deposit_months', 6.5],
    ['notice_days', 181], ['deposit_refund_days', 91], ['renewal_months', 25], ['drilling_fee', -1],
  ])('rejects %s = %s', (field, value) => {
    expect(buildingContractProfileSchema.safeParse({ [field]: value }).success).toBe(false)
  })
})
