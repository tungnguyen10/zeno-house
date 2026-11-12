import { describe, expect, it } from 'vitest'
import { computeBuildingReadiness } from '../../../server/services/buildings/readiness'
import type { BuildingContractProfile } from '~/types/building-contract-profile'

const building = {
  billingGenerationDay: 1, paymentDueDay: 5,
  electricityPricingType: 'per_kwh', defaultElectricityRate: 3500,
  waterPricingType: 'per_m3', defaultWaterRate: 15000,
} as const

const profile: BuildingContractProfile = {
  buildingId: 'b-1', lessorFullName: 'A', lessorDateOfBirth: '1980-01-01', lessorPermanentAddress: 'X',
  lessorIdNumber: '012345678901', lessorIdIssuedDate: '2020-01-01', lessorIdIssuedPlace: 'Y', lessorPhone: '0901234567',
  lessorIdentityMasked: false, brandName: null, defaultTermMonths: 12, defaultDepositMonths: 1, noticeDays: 30,
  depositRefundDays: 7, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0, fingerprintResetFee: 0,
  signedCopies: 2, copiesPerParty: 1, updatedAt: '', updatedBy: null,
}

describe('computeBuildingReadiness', () => {
  it('is fully ready when everything is configured (zero values count as set)', () => {
    expect(computeBuildingReadiness(building as never, profile, true)).toEqual({
      contract: { ready: true, missing: [] },
      billing: { ready: true, missing: [] },
    })
  })

  it('lists every contract code when the profile is missing', () => {
    const r = computeBuildingReadiness(building as never, null, true)
    expect(r.contract.ready).toBe(false)
    expect(r.contract.missing).toEqual([
      'lessor.full_name', 'lessor.date_of_birth', 'lessor.permanent_address', 'lessor.id_number',
      'lessor.id_issued_date', 'lessor.id_issued_place', 'lessor.phone',
      'contract.default_term_months', 'contract.default_deposit_months',
      'terms.notice_days', 'terms.deposit_refund_days', 'terms.renewal_months',
      'terms.extra_occupant_fee', 'terms.drilling_fee', 'terms.fingerprint_reset_fee',
    ])
    expect(r.billing.ready).toBe(true)
  })

  it('missing invoice profile blocks both', () => {
    const r = computeBuildingReadiness(building as never, profile, false)
    expect(r.contract.missing).toEqual(['invoice_profile'])
    expect(r.billing.missing).toEqual(['invoice_profile'])
  })

  it('missing schedule blocks both with billing.schedule', () => {
    const r = computeBuildingReadiness({ ...building, paymentDueDay: null } as never, profile, true)
    expect(r.contract.missing).toContain('billing.schedule')
    expect(r.billing.missing).toContain('billing.schedule')
  })

  it('requires utility rates except for tiered electricity', () => {
    const r = computeBuildingReadiness({ ...building, defaultElectricityRate: null, defaultWaterRate: null } as never, profile, true)
    expect(r.billing.missing).toEqual(['billing.electricity_rate', 'billing.water_rate'])
    expect(r.contract.ready).toBe(true)
    const tiered = computeBuildingReadiness({ ...building, electricityPricingType: 'tiered', defaultElectricityRate: null } as never, profile, true)
    expect(tiered.billing.missing).not.toContain('billing.electricity_rate')
  })
})
