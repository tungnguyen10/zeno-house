import { describe, expect, it } from 'vitest'
import { buildingFormToApiPayload, buildingToFormData, emptyBuildingFormData } from '~/utils/mappers/building-form'
import type { Building } from '~/types/buildings'

const building = {
  id: 'b-1',
  name: 'Tòa A',
  address: '1 Lê Lợi',
  description: null,
  status: 'active',
  ownerName: null,
  ownerPhone: '0900000001',
  ownerEmail: null,
  electricityPricingType: 'per_kwh',
  defaultElectricityRate: 3500,
  waterPricingType: 'per_m3',
  defaultWaterRate: null,
  meterReadingDay: 28,
  billingGenerationDay: 1,
  paymentDueDay: 5,
  gracePeriodDays: 3,
  operationalStartYear: 2026,
  operationalStartMonth: 6,
} as unknown as Building

describe('buildingToFormData', () => {
  it('maps a building to string form fields', () => {
    expect(buildingToFormData(building)).toEqual({
      name: 'Tòa A',
      address: '1 Lê Lợi',
      description: '',
      status: 'active',
      ownerName: '',
      ownerPhone: '0900000001',
      ownerEmail: '',
      electricityPricingType: 'per_kwh',
      defaultElectricityRate: '3500',
      waterPricingType: 'per_m3',
      defaultWaterRate: '',
      meterReadingDay: '28',
      billingGenerationDay: '1',
      paymentDueDay: '5',
      gracePeriodDays: '3',
      operationalStartYear: '2026',
      operationalStartMonth: '6',
    })
  })

  it('defaults grace period to 0 when missing', () => {
    expect(buildingToFormData({ ...building, gracePeriodDays: undefined } as unknown as Building).gracePeriodDays).toBe('0')
  })

  it('round-trips through the API payload without changing values', () => {
    const payload = buildingFormToApiPayload(buildingToFormData(building))

    expect(payload).toMatchObject({
      name: 'Tòa A',
      default_electricity_rate: 3500,
      default_water_rate: null,
      payment_due_day: 5,
      grace_period_days: 3,
      owner_name: null,
    })
  })
})

describe('emptyBuildingFormData', () => {
  it('starts with active status and zero grace period', () => {
    expect(emptyBuildingFormData()).toMatchObject({ status: 'active', gracePeriodDays: '0', name: '' })
  })
})
