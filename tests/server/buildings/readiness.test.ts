import { describe, expect, it } from 'vitest'
import { computeBuildingReadiness } from '../../../server/services/buildings/readiness'
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile } from '~/types/building-contract-profile'

const building = {
  billingGenerationDay: 1,
  paymentDueDay: 5,
  electricityPricingType: 'per_kwh',
  defaultElectricityRate: 3500,
  waterPricingType: 'per_m3',
  defaultWaterRate: 15000,
} as const

const profile: BuildingContractProfile = {
  buildingId: 'b-1',
  lessorFullName: 'A',
  lessorDateOfBirth: '1980-01-01',
  lessorPermanentAddress: 'X',
  lessorIdNumber: '012345678901',
  lessorIdIssuedDate: '2020-01-01',
  lessorIdIssuedPlace: 'Y',
  lessorPhone: '0901234567',
  lessorIdentityMasked: false,
  brandName: null,
  defaultTermMonths: 12,
  defaultDepositMonths: 0,
  noticeDays: 0,
  depositRefundDays: 0,
  renewalMonths: 0,
  extraOccupantFee: 0,
  drillingFee: 0,
  fingerprintResetFee: 0,
  signedCopies: 2,
  copiesPerParty: 1,
  updatedAt: '',
  updatedBy: null,
}

const requiredContractFields = [
  ['lessorFullName', 'lessor.full_name'],
  ['lessorDateOfBirth', 'lessor.date_of_birth'],
  ['lessorPermanentAddress', 'lessor.permanent_address'],
  ['lessorIdNumber', 'lessor.id_number'],
  ['lessorIdIssuedDate', 'lessor.id_issued_date'],
  ['lessorIdIssuedPlace', 'lessor.id_issued_place'],
  ['lessorPhone', 'lessor.phone'],
  ['defaultTermMonths', 'contract.default_term_months'],
  ['defaultDepositMonths', 'contract.default_deposit_months'],
  ['noticeDays', 'terms.notice_days'],
  ['depositRefundDays', 'terms.deposit_refund_days'],
  ['renewalMonths', 'terms.renewal_months'],
  ['extraOccupantFee', 'terms.extra_occupant_fee'],
  ['drillingFee', 'terms.drilling_fee'],
  ['fingerprintResetFee', 'terms.fingerprint_reset_fee'],
] as const

describe('computeBuildingReadiness', () => {
  it('is fully ready when configured, including zero fees, terms, deposit and rates', () => {
    expect(computeBuildingReadiness({ ...building, defaultElectricityRate: 0, defaultWaterRate: 0 }, profile, true)).toEqual({
      contract: { ready: true, missing: [] },
      billing: { ready: true, missing: [] },
    })
  })

  it('lists every contract code in stable order when the profile is missing', () => {
    expect(computeBuildingReadiness(building, null, true)).toEqual({
      contract: { ready: false, missing: requiredContractFields.map(([, code]) => code) },
      billing: { ready: true, missing: [] },
    })
  })

  it.each(requiredContractFields)('reports only %s when that field is missing', (field, code) => {
    expect(computeBuildingReadiness(building, { ...profile, [field]: null }, true)).toEqual({
      contract: { ready: false, missing: [code] },
      billing: { ready: true, missing: [] },
    })
  })

  it('supports a partial profile containing only the lessor name', () => {
    const partialProfile = { ...profile }
    for (const [field] of requiredContractFields) {
      if (field !== 'lessorFullName') partialProfile[field] = null
    }
    expect(computeBuildingReadiness(building, partialProfile, true).contract).toEqual({
      ready: false,
      missing: requiredContractFields.slice(1).map(([, code]) => code),
    })
  })

  it('blocks both statuses when the invoice profile is missing', () => {
    expect(computeBuildingReadiness(building, profile, false)).toEqual({
      contract: { ready: false, missing: ['invoice_profile'] },
      billing: { ready: false, missing: ['invoice_profile'] },
    })
  })

  it.each(['billingGenerationDay', 'paymentDueDay'] as const)('blocks both statuses when %s is missing', (field) => {
    expect(computeBuildingReadiness({ ...building, [field]: null }, profile, true)).toEqual({
      contract: { ready: false, missing: ['billing.schedule'] },
      billing: { ready: false, missing: ['billing.schedule'] },
    })
  })

  it.each(['per_kwh', 'fixed'] satisfies Building['electricityPricingType'][])('requires an electricity rate for %s', (electricityPricingType) => {
    const result = computeBuildingReadiness({ ...building, electricityPricingType, defaultElectricityRate: null }, profile, true)
    expect(result.billing).toEqual({ ready: false, missing: ['billing.electricity_rate'] })
    expect(result.contract.ready).toBe(true)
  })

  it('does not require a default electricity rate for tiered pricing', () => {
    expect(computeBuildingReadiness({ ...building, electricityPricingType: 'tiered', defaultElectricityRate: null }, profile, true).billing)
      .toEqual({ ready: true, missing: [] })
  })

  it.each(['per_m3', 'per_person', 'fixed_per_room'] satisfies Building['waterPricingType'][])('requires a water rate for %s', (waterPricingType) => {
    const result = computeBuildingReadiness({ ...building, waterPricingType, defaultWaterRate: null }, profile, true)
    expect(result.billing).toEqual({ ready: false, missing: ['billing.water_rate'] })
    expect(result.contract.ready).toBe(true)
  })

  it('accumulates shared and billing requirements without duplicate schedule codes', () => {
    expect(computeBuildingReadiness({ ...building, billingGenerationDay: null, paymentDueDay: null, defaultElectricityRate: null, defaultWaterRate: null }, profile, false)).toEqual({
      contract: { ready: false, missing: ['billing.schedule', 'invoice_profile'] },
      billing: { ready: false, missing: ['billing.schedule', 'billing.electricity_rate', 'billing.water_rate', 'invoice_profile'] },
    })
  })
})
