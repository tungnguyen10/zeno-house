import type { UtilityReadingRuleInput } from '~/server/services/billing/rules'
import type { MeterReading } from '~/types/meter-readings'

export function buildReading(overrides: Partial<MeterReading> & {
  value?: number
  is_replacement?: boolean
  is_reset?: boolean
  requires_override?: boolean
  override?: UtilityReadingRuleInput['override']
} = {}): MeterReading & {
  is_replacement?: boolean
  is_reset?: boolean
  requires_override?: boolean
  override?: UtilityReadingRuleInput['override']
} {
  const value = overrides.value ?? overrides.readingValue ?? 120
  return {
    id: 'reading-1',
    roomId: 'room-1',
    buildingId: 'building-1',
    meterType: 'electricity',
    readingType: 'monthly',
    periodYear: 2026,
    periodMonth: 5,
    readingDate: '2026-05-31',
    readingValue: value,
    isEstimated: false,
    notes: null,
    recordedBy: 'user-1',
    createdAt: '2026-05-31T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z',
    ...overrides,
  }
}

export function buildUtilityReading(overrides: UtilityReadingRuleInput = {}): UtilityReadingRuleInput {
  return {
    previous: { id: 'previous-reading', value: 100 },
    current: { id: 'current-reading', value: 125 },
    handover: null,
    override: null,
    ...overrides,
  }
}
