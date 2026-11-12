import { describe, expect, it } from 'vitest'
import { mapBuildingContractProfile, maskBuildingContractProfile, maskIdNumber } from '~/utils/mappers/building-contract-profile'

const row = {
  building_id: 'b-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi, Huế', lessor_id_number: '012345678901', lessor_id_issued_date: '2021-05-01',
  lessor_id_issued_place: 'Huế', lessor_phone: '0901234567', brand_name: null, default_term_months: 12,
  default_deposit_months: '1.5', notice_days: 30, deposit_refund_days: 7, renewal_months: 6,
  extra_occupant_fee: '500000', drilling_fee: '50000', fingerprint_reset_fee: '100000', signed_copies: 2,
  copies_per_party: 1, updated_by: 'u-1', created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}

describe('building contract profile mapper', () => {
  it('maps numeric strings to numbers', () => {
    const p = mapBuildingContractProfile(row)
    expect(p).toMatchObject({ defaultDepositMonths: 1.5, extraOccupantFee: 500000, lessorIdentityMasked: false })
  })

  it('masks id to last 4 digits', () => {
    expect(maskIdNumber('012345678901')).toBe('*******8901')
    expect(maskIdNumber(null)).toBeNull()
  })

  it('masked profile contains no raw PII', () => {
    const masked = maskBuildingContractProfile(mapBuildingContractProfile(row))
    const json = JSON.stringify(masked)
    expect(json).not.toContain('012345678901')
    expect(json).not.toContain('1980-01-02')
    expect(json).not.toContain('Lê Lợi')
    expect(masked).toMatchObject({ lessorIdentityMasked: true, lessorIdNumber: '*******8901', lessorDateOfBirth: null, lessorPermanentAddress: null })
  })
})

it('preserves null numeric values and handles a missing timestamp', () => {
  expect(mapBuildingContractProfile({ ...row, default_deposit_months: null, extra_occupant_fee: null, drilling_fee: null, fingerprint_reset_fee: null, updated_at: null })).toMatchObject({ defaultDepositMonths: null, extraOccupantFee: null, drillingFee: null, fingerprintResetFee: null, updatedAt: '' })
})

it('masks legacy ids without mutating the original DTO', () => {
  const original = mapBuildingContractProfile({ ...row, lessor_id_number: '123456789' })
  const masked = maskBuildingContractProfile(original)
  expect(masked.lessorIdNumber).toBe('*******6789')
  expect(original.lessorIdNumber).toBe('123456789')
  expect(original.lessorIdentityMasked).toBe(false)
  expect(maskBuildingContractProfile(masked)).toEqual(masked)
})
