import {
  calculateRequiredReadingProgress,
  isBillableContractInPeriod,
  requiredMeterTypesForPricing,
  type BillableContractPeriodRow,
} from '../../../server/services/billing/core'

function contract(overrides: Partial<BillableContractPeriodRow> = {}): BillableContractPeriodRow {
  return {
    id: 'contract-1',
    building_id: 'building-1',
    room_id: 'room-1',
    start_date: '2026-05-01',
    end_date: '2026-05-31',
    status: 'active',
    ...overrides,
  }
}

describe('billing core period eligibility', () => {
  it.each(['active', 'expired', 'renewed'])('includes %s contracts when dates overlap', (status) => {
    expect(isBillableContractInPeriod(contract({ status }), 'building-1', 2026, 5)).toBe(true)
  })

  it('excludes terminated contracts', () => {
    expect(isBillableContractInPeriod(contract({ status: 'terminated' }), 'building-1', 2026, 5)).toBe(false)
  })

  it('excludes contracts outside the selected building or period', () => {
    expect(isBillableContractInPeriod(contract({ building_id: 'building-2' }), 'building-1', 2026, 5)).toBe(false)
    expect(isBillableContractInPeriod(contract({ start_date: '2026-06-01', end_date: null }), 'building-1', 2026, 5)).toBe(false)
    expect(isBillableContractInPeriod(contract({ start_date: '2026-04-01', end_date: '2026-04-30' }), 'building-1', 2026, 5)).toBe(false)
  })

  it('includes contracts that overlap either edge of the month', () => {
    expect(isBillableContractInPeriod(contract({ start_date: '2026-04-20', end_date: '2026-05-01' }), 'building-1', 2026, 5)).toBe(true)
    expect(isBillableContractInPeriod(contract({ start_date: '2026-05-31', end_date: '2026-06-30' }), 'building-1', 2026, 5)).toBe(true)
  })
})

describe('billing core required reading progress', () => {
  it('requires electricity for per_kwh and water for per_m3', () => {
    expect(requiredMeterTypesForPricing({
      electricity_pricing_type: 'per_kwh',
      water_pricing_type: 'per_m3',
    })).toEqual(['electricity', 'water'])
  })

  it.each(['per_person', 'fixed_per_room'])('does not require water readings for %s water pricing', (water_pricing_type) => {
    const progress = calculateRequiredReadingProgress({
      contracts: [contract()],
      pricing: { electricity_pricing_type: 'per_kwh', water_pricing_type },
      readings: [{ room_id: 'room-1', meter_type: 'electricity' }],
    })

    expect(progress).toEqual({ complete: 1, required: 1 })
  })

  it('counts meter readings and utility overrides as complete', () => {
    const progress = calculateRequiredReadingProgress({
      contracts: [contract(), contract({ id: 'contract-2', room_id: 'room-2' })],
      pricing: { electricity_pricing_type: 'per_kwh', water_pricing_type: 'per_m3' },
      readings: [
        { room_id: 'room-1', meter_type: 'electricity' },
        { room_id: 'room-2', meter_type: 'water' },
      ],
      overrides: [
        { roomId: 'room-1', meterType: 'water' },
      ],
    })

    expect(progress).toEqual({ complete: 3, required: 4 })
  })

  it('deduplicates required room meter pairs', () => {
    const progress = calculateRequiredReadingProgress({
      contracts: [contract(), contract({ id: 'contract-2' })],
      pricing: { electricity_pricing_type: 'per_kwh', water_pricing_type: 'per_m3' },
      readings: [
        { room_id: 'room-1', meter_type: 'electricity' },
        { room_id: 'room-1', meter_type: 'water' },
      ],
    })

    expect(progress).toEqual({ complete: 2, required: 2 })
  })
})
