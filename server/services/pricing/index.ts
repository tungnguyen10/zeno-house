import type { RoomBillingInput, RoomBillingResult, BillingWarning } from './types'

/**
 * Pure function: calculate billing for a single room/contract.
 * No DB access. No side effects. Unit testable without mocks.
 */
export function calculateRoomBilling(input: RoomBillingInput): RoomBillingResult {
  const warnings: BillingWarning[] = []
  const { contract, services, meterReadings, buildingRates } = input

  // ── Rent ──────────────────────────────────────────────────────────────
  const rentAmount = contract.monthlyRent + contract.surchargeAmount - contract.discountAmount
  if (rentAmount === 0) warnings.push({ type: 'zero_rent' })

  // ── Services ──────────────────────────────────────────────────────────
  const serviceSnapshots: RoomBillingResult['serviceSnapshots'] = []
  let serviceAmount = 0

  for (const svc of services) {
    const quantity = svc.pricingType === 'per_person' ? contract.occupantCount : svc.quantity
    const total = svc.amount * quantity
    serviceAmount += total
    serviceSnapshots.push({
      catalogId: svc.catalogId,
      serviceName: svc.name,
      pricingType: svc.pricingType,
      amount: svc.amount,
      quantity,
      total,
    })
  }

  // ── Electricity ───────────────────────────────────────────────────────
  const electricityReading = meterReadings.find(r => r.meterType === 'electricity')
  let electricityAmount = 0
  const electricitySnapshot: RoomBillingResult['utilitySnapshots'][number] | null =
    electricityReading
      ? calculateUtility(electricityReading, buildingRates.electricityRate, contract.occupantCount, 'per_unit', warnings)
      : null

  if (!electricityReading) {
    warnings.push({ type: 'missing_reading', meterType: 'electricity' })
  } else if (electricitySnapshot) {
    electricityAmount = electricitySnapshot.total
  }

  // ── Water ─────────────────────────────────────────────────────────────
  const waterReading = meterReadings.find(r => r.meterType === 'water')
  let waterAmount = 0
  const waterSnapshot: RoomBillingResult['utilitySnapshots'][number] | null =
    waterReading
      ? calculateUtility(waterReading, buildingRates.waterRate, contract.occupantCount, buildingRates.waterPricingType, warnings)
      : null

  if (!waterReading) {
    warnings.push({ type: 'missing_reading', meterType: 'water' })
  } else if (waterSnapshot) {
    waterAmount = waterSnapshot.total
  }

  // ── Totals ────────────────────────────────────────────────────────────
  const utilityAmount = electricityAmount + waterAmount
  const totalAmount = rentAmount + serviceAmount + utilityAmount

  const utilitySnapshots: RoomBillingResult['utilitySnapshots'] = []
  if (electricitySnapshot) utilitySnapshots.push(electricitySnapshot)
  if (waterSnapshot) utilitySnapshots.push(waterSnapshot)

  return {
    amounts: { rentAmount, serviceAmount, electricityAmount, waterAmount, utilityAmount, totalAmount },
    contractSnapshot: {
      monthlyRent: contract.monthlyRent,
      surchargeAmount: contract.surchargeAmount,
      discountAmount: contract.discountAmount,
      paymentDay: contract.paymentDay,
      occupantCount: contract.occupantCount,
    },
    serviceSnapshots,
    utilitySnapshots,
    warnings,
  }
}

function calculateUtility(
  reading: RoomBillingInput['meterReadings'][number],
  rate: number | null,
  occupantCount: number,
  pricingType: 'per_unit' | 'per_person',
  warnings: BillingWarning[],
): RoomBillingResult['utilitySnapshots'][number] {
  const meterType = reading.meterType

  if (rate == null) {
    warnings.push({ type: 'no_rate_configured', meterType })
    return {
      meterType,
      oldReading: reading.oldReading,
      newReading: reading.newReading,
      consumption: reading.consumption,
      unitPrice: null,
      total: 0,
      isAdjusted: reading.isAdjusted,
      adjustmentReason: reading.adjustmentReason,
    }
  }

  let consumption = reading.consumption
  if (!reading.isAdjusted && reading.oldReading != null && reading.newReading != null) {
    consumption = reading.newReading - reading.oldReading
  }

  if (consumption != null && consumption < 0) {
    warnings.push({ type: 'negative_consumption', meterType, value: consumption })
    return {
      meterType,
      oldReading: reading.oldReading,
      newReading: reading.newReading,
      consumption,
      unitPrice: rate,
      total: 0,
      isAdjusted: reading.isAdjusted,
      adjustmentReason: reading.adjustmentReason,
    }
  }

  let total = 0
  if (pricingType === 'per_person') {
    total = rate * occupantCount
  } else {
    total = consumption != null ? consumption * rate : 0
  }

  return {
    meterType,
    oldReading: reading.oldReading,
    newReading: reading.newReading,
    consumption,
    unitPrice: rate,
    total,
    isAdjusted: reading.isAdjusted,
    adjustmentReason: reading.adjustmentReason,
  }
}
