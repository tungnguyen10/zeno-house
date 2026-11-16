import type { BuildingFormData } from '~/types/building-form'
import type { Building } from '~/types/buildings'
import type { BuildingCreateInput } from '~/utils/validators/buildings'

/** Convert UI form data (camelCase, strings) to the API payload (snake_case, typed). */
export function buildingFormToApiPayload(data: BuildingFormData): BuildingCreateInput {
  const toNum = (v: string | null | undefined): number | null => (v == null || v === '' ? null : Number(v))

  return {
    name: data.name.trim(),
    address: data.address.trim(),
    description: data.description.trim() || null,
    status: data.status,
    owner_name: data.ownerName.trim() || null,
    owner_phone: data.ownerPhone.trim() || null,
    owner_email: data.ownerEmail.trim() || null,
    electricity_pricing_type: data.electricityPricingType,
    default_electricity_rate: toNum(data.defaultElectricityRate),
    water_pricing_type: data.waterPricingType,
    default_water_rate: toNum(data.defaultWaterRate),
    meter_reading_day: toNum(data.meterReadingDay),
    billing_generation_day: toNum(data.billingGenerationDay),
    payment_due_day: toNum(data.paymentDueDay),
    grace_period_days: data.gracePeriodDays === '' ? 0 : Number(data.gracePeriodDays),
    operational_start_year: toNum(data.operationalStartYear),
    operational_start_month: toNum(data.operationalStartMonth),
  }
}

export function emptyBuildingFormData(): BuildingFormData {
  return {
    name: '',
    address: '',
    description: '',
    status: 'active',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    electricityPricingType: 'per_kwh',
    defaultElectricityRate: '',
    waterPricingType: 'per_m3',
    defaultWaterRate: '',
    meterReadingDay: '',
    billingGenerationDay: '',
    paymentDueDay: '',
    gracePeriodDays: '0',
    operationalStartYear: '',
    operationalStartMonth: '',
  }
}

export function buildingToFormData(b: Building): BuildingFormData {
  return {
    name: b.name,
    address: b.address,
    description: b.description ?? '',
    status: b.status,
    ownerName: b.ownerName ?? '',
    ownerPhone: b.ownerPhone ?? '',
    ownerEmail: b.ownerEmail ?? '',
    electricityPricingType: b.electricityPricingType,
    defaultElectricityRate: b.defaultElectricityRate?.toString() ?? '',
    waterPricingType: b.waterPricingType,
    defaultWaterRate: b.defaultWaterRate?.toString() ?? '',
    meterReadingDay: b.meterReadingDay?.toString() ?? '',
    billingGenerationDay: b.billingGenerationDay?.toString() ?? '',
    paymentDueDay: b.paymentDueDay?.toString() ?? '',
    gracePeriodDays: b.gracePeriodDays?.toString() ?? '0',
    operationalStartYear: b.operationalStartYear?.toString() ?? '',
    operationalStartMonth: b.operationalStartMonth?.toString() ?? '',
  }
}
