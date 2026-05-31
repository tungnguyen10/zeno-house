export interface BillingRowInput {
  oldElec: number | null
  newElec: number | null
  oldWater: number | null
  newWater: number | null
  electricityRate: number
  waterRate: number
  monthlyRent: number
  surchargeAmount: number
  discountAmount: number
  services: Array<{
    pricingType: 'fixed' | 'per_person'
    amount: number
    quantity: number
    isEnabled: boolean
  }>
  occupantCount: number
}

export interface BillingRowAmounts {
  elecConsumption: number | null
  waterConsumption: number | null
  electricityAmount: number | null
  waterAmount: number | null
  roomServiceAmount: number
  totalAmount: number
}

export function calculateRowAmounts(input: BillingRowInput): BillingRowAmounts {
  const elecConsumption =
    input.oldElec != null && input.newElec != null
      ? input.newElec - input.oldElec
      : null

  const waterConsumption =
    input.oldWater != null && input.newWater != null
      ? input.newWater - input.oldWater
      : null

  const electricityAmount =
    elecConsumption != null ? elecConsumption * input.electricityRate : null

  const waterAmount =
    waterConsumption != null ? waterConsumption * input.waterRate : null

  // Room + services
  const serviceTotal = input.services
    .filter(s => s.isEnabled)
    .reduce((sum, s) => {
      if (s.pricingType === 'per_person') {
        return sum + s.amount * input.occupantCount
      }
      return sum + s.amount * s.quantity
    }, 0)

  const roomServiceAmount =
    input.monthlyRent + input.surchargeAmount - input.discountAmount + serviceTotal

  const totalAmount =
    roomServiceAmount + (electricityAmount ?? 0) + (waterAmount ?? 0)

  return {
    elecConsumption,
    waterConsumption,
    electricityAmount,
    waterAmount,
    roomServiceAmount,
    totalAmount,
  }
}
