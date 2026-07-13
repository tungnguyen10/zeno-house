import type { H3Event } from 'h3'
import { db as serverSupabaseClient } from '../../utils/db'
import { BillingUtilityUsageRepository } from '../../repositories/billing/utility-usages'
import type { BillingPeriod } from '~/types/billing'

export type BillableContractStatus = 'active' | 'expired' | 'renewed' | string
export type RequiredMeterType = 'electricity' | 'water'

export interface BillableContractPeriodRow {
  id: string
  building_id: string
  room_id: string
  start_date: string
  end_date: string | null
  status: BillableContractStatus
}

export interface BillingPricingRules {
  electricity_pricing_type: string | null
  water_pricing_type: string | null
}

export interface ReadingProgressReading {
  room_id: string
  meter_type: RequiredMeterType
}

export interface ReadingProgressOverride {
  roomId: string
  meterType: RequiredMeterType
}

export interface BatchedPeriodInputs {
  contractsByPeriod: Map<string, BillableContractPeriodRow[]>
  readingsByPeriod: Map<string, ReadingProgressReading[]>
  overridesByPeriod: Map<string, ReadingProgressOverride[]>
}

export function billingPeriodBounds(year: number, month: number): { first: string; last: string } {
  const first = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { first, last }
}

export function isBillableContractStatus(status: string | null | undefined): boolean {
  return status !== 'terminated'
}

export function contractOverlapsBillingPeriod(
  contract: Pick<BillableContractPeriodRow, 'start_date' | 'end_date'>,
  periodYear: number,
  periodMonth: number,
): boolean {
  const { first, last } = billingPeriodBounds(periodYear, periodMonth)
  if (contract.start_date > last) return false
  if (contract.end_date && contract.end_date < first) return false
  return true
}

export function isBillableContractInPeriod(
  contract: BillableContractPeriodRow,
  buildingId: string,
  periodYear: number,
  periodMonth: number,
): boolean {
  return contract.building_id === buildingId
    && isBillableContractStatus(contract.status)
    && contractOverlapsBillingPeriod(contract, periodYear, periodMonth)
}

export async function loadBillableContractsInPeriod<T extends BillableContractPeriodRow>(
  event: H3Event,
  input: {
    buildingId: string
    periodYear: number
    periodMonth: number
    select: string
  },
): Promise<T[]> {
  const supabase = await serverSupabaseClient(event)
  const { first, last } = billingPeriodBounds(input.periodYear, input.periodMonth)
  const { data, error } = await supabase
    .from('contracts')
    .select(input.select)
    .eq('building_id', input.buildingId)
    .lte('start_date', last)
    .or(`end_date.gte.${first},end_date.is.null`)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return ((data ?? []) as unknown as T[]).filter(contract =>
    isBillableContractInPeriod(contract, input.buildingId, input.periodYear, input.periodMonth),
  )
}

export function requiredMeterTypesForPricing(pricing: BillingPricingRules): RequiredMeterType[] {
  const meters: RequiredMeterType[] = []
  if (pricing.electricity_pricing_type === 'per_kwh') meters.push('electricity')
  if (pricing.water_pricing_type === 'per_m3') meters.push('water')
  return meters
}

export function calculateRequiredReadingProgress(input: {
  contracts: Array<Pick<BillableContractPeriodRow, 'room_id'>>
  pricing: BillingPricingRules
  readings: ReadingProgressReading[]
  overrides?: ReadingProgressOverride[]
}): { complete: number; required: number } {
  const requiredMeters = requiredMeterTypesForPricing(input.pricing)
  if (input.contracts.length === 0 || requiredMeters.length === 0) {
    return { complete: 0, required: 0 }
  }

  const requiredKeys = new Set<string>()
  for (const contract of input.contracts) {
    for (const meter of requiredMeters) {
      requiredKeys.add(`${contract.room_id}::${meter}`)
    }
  }

  const completeKeys = new Set<string>()
  for (const reading of input.readings) {
    completeKeys.add(`${reading.room_id}::${reading.meter_type}`)
  }
  for (const override of input.overrides ?? []) {
    completeKeys.add(`${override.roomId}::${override.meterType}`)
  }

  let complete = 0
  for (const key of requiredKeys) {
    if (completeKeys.has(key)) complete += 1
  }
  return { complete, required: requiredKeys.size }
}

export async function loadRequiredReadingProgress(
  event: H3Event,
  input: {
    buildingId: string
    periodId: string
    periodYear: number
    periodMonth: number
    pricing: BillingPricingRules
    contracts?: BillableContractPeriodRow[]
  },
): Promise<{ complete: number; required: number }> {
  const contracts = input.contracts ?? await loadBillableContractsInPeriod<BillableContractPeriodRow>(event, {
    buildingId: input.buildingId,
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
    select: 'id, building_id, room_id, start_date, end_date, status',
  })
  const requiredMeters = requiredMeterTypesForPricing(input.pricing)
  if (contracts.length === 0 || requiredMeters.length === 0) {
    return { complete: 0, required: 0 }
  }

  const supabase = await serverSupabaseClient(event)
  const roomIds = [...new Set(contracts.map(contract => contract.room_id))]
  const { data: readings, error } = await supabase
    .from('meter_readings')
    .select('room_id, meter_type')
    .in('room_id', roomIds)
    .eq('period_year', input.periodYear)
    .eq('period_month', input.periodMonth)
    .eq('reading_type', 'monthly')
    .in('meter_type', requiredMeters)
  if (error) throw createError({ statusCode: 500, message: error.message })

  const overrides = await BillingUtilityUsageRepository.listByPeriod(event, input.periodId)
  return calculateRequiredReadingProgress({
    contracts,
    pricing: input.pricing,
    readings: (readings ?? []) as ReadingProgressReading[],
    overrides: overrides.map(override => ({
      roomId: override.roomId,
      meterType: override.meterType,
    })),
  })
}

/** Load all inputs needed by the period queue in a fixed number of queries. */
export async function loadBatchedPeriodInputs(
  event: H3Event,
  periods: BillingPeriod[],
  pricingByBuilding: Map<string, BillingPricingRules>,
): Promise<BatchedPeriodInputs> {
  const contractsByPeriod = new Map<string, BillableContractPeriodRow[]>()
  const readingsByPeriod = new Map<string, ReadingProgressReading[]>()
  const overridesByPeriod = new Map<string, ReadingProgressOverride[]>()
  if (periods.length === 0) return { contractsByPeriod, readingsByPeriod, overridesByPeriod }

  const supabase = await serverSupabaseClient(event)
  const buildingIds = [...new Set(periods.map(period => period.buildingId))]
  const bounds = periods.map(period => billingPeriodBounds(period.periodYear, period.periodMonth))
  const earliest = bounds.reduce((value, bound) => bound.first < value ? bound.first : value, bounds[0]!.first)
  const latest = bounds.reduce((value, bound) => bound.last > value ? bound.last : value, bounds[0]!.last)

  const [{ data: contractData, error: contractError }, overrides] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, building_id, room_id, start_date, end_date, status')
      .in('building_id', buildingIds)
      .lte('start_date', latest)
      .or(`end_date.gte.${earliest},end_date.is.null`),
    BillingUtilityUsageRepository.listByPeriods(event, periods.map(period => period.id)),
  ])
  if (contractError) throw createError({ statusCode: 500, message: contractError.message })

  const contracts = (contractData ?? []) as BillableContractPeriodRow[]
  for (const period of periods) {
    contractsByPeriod.set(period.id, contracts.filter(contract =>
      isBillableContractInPeriod(contract, period.buildingId, period.periodYear, period.periodMonth),
    ))
  }
  for (const override of overrides) {
    const list = overridesByPeriod.get(override.billingPeriodId) ?? []
    list.push({ roomId: override.roomId, meterType: override.meterType })
    overridesByPeriod.set(override.billingPeriodId, list)
  }

  const roomIds = [...new Set(contracts.map(contract => contract.room_id))]
  const meterTypes = [...new Set(periods.flatMap(period =>
    requiredMeterTypesForPricing(pricingByBuilding.get(period.buildingId) ?? {
      electricity_pricing_type: null,
      water_pricing_type: null,
    }),
  ))]
  if (roomIds.length === 0 || meterTypes.length === 0) {
    return { contractsByPeriod, readingsByPeriod, overridesByPeriod }
  }

  const years = periods.map(period => period.periodYear)
  const { data: readingData, error: readingError } = await supabase
    .from('meter_readings')
    .select('room_id, meter_type, period_year, period_month')
    .in('room_id', roomIds)
    .gte('period_year', Math.min(...years))
    .lte('period_year', Math.max(...years))
    .eq('reading_type', 'monthly')
    .in('meter_type', meterTypes)
  if (readingError) throw createError({ statusCode: 500, message: readingError.message })

  const readings = (readingData ?? []) as Array<ReadingProgressReading & { period_year: number, period_month: number }>
  for (const period of periods) {
    const roomSet = new Set((contractsByPeriod.get(period.id) ?? []).map(contract => contract.room_id))
    readingsByPeriod.set(period.id, readings.filter(reading =>
      reading.period_year === period.periodYear
      && reading.period_month === period.periodMonth
      && roomSet.has(reading.room_id),
    ))
  }

  return { contractsByPeriod, readingsByPeriod, overridesByPeriod }
}
