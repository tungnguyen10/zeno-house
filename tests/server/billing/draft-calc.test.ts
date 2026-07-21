import { calculateDraftRule } from '../../../server/services/billing/rules'
import { buildContractCharges, buildDraftContract } from '../../__fixtures__/billing/contract'
import { buildUtilityReading } from '../../__fixtures__/billing/reading'

const period = { periodYear: 2026, periodMonth: 5 }

describe('billing draft calculation rules', () => {
  it('prorates rent by date range', () => {
    const result = calculateDraftRule({
      period,
      contract: buildDraftContract({ monthlyRent: 3_100_000, startDate: '2026-05-16' }),
    })

    expect(result.lines.find(line => line.chargeType === 'rent')?.amount).toBe(1_600_000)
  })

  it('applies discount after rent', () => {
    const result = calculateDraftRule({
      period,
      contract: buildDraftContract({ monthlyRent: 3_100_000, discountAmount: 100_000 }),
    })

    expect(result.subtotalAmount).toBe(3_100_000)
    expect(result.discountAmount).toBe(100_000)
    expect(result.totalAmount).toBe(3_000_000)
  })

  it('calculates electricity per_kwh', () => {
    const charges = buildContractCharges()
    const result = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      electricity: charges.electricity,
      readings: { electricity: buildUtilityReading() },
    })

    const line = result.lines.find(item => item.chargeType === 'electricity')
    expect(line?.quantity).toBe(25)
    expect(line?.amount).toBe(100_000)
    expect(line?.metadata.billable_usage).toBe(25)
  })

  it('calculates electricity tiered multi-bracket charges', () => {
    const charges = buildContractCharges({
      electricity: {
        pricingType: 'tiered',
        rate: 0,
        brackets: [
          { upTo: 10, unitPrice: 3_000 },
          { upTo: 20, unitPrice: 4_000 },
          { upTo: null, unitPrice: 5_000 },
        ],
      },
    })
    const result = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      electricity: charges.electricity,
      readings: { electricity: buildUtilityReading() },
    })

    const line = result.lines.find(item => item.chargeType === 'electricity')
    expect(line?.amount).toBe(95_000)
    expect(line?.metadata.tier_breakdown).toHaveLength(3)
  })

  it('calculates electricity fixed and per_person modes', () => {
    const fixed = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      electricity: buildContractCharges({ electricity: { pricingType: 'fixed', rate: 200_000 } }).electricity,
    })
    const perPerson = calculateDraftRule({
      period,
      contract: buildDraftContract({ occupantCount: 3 }),
      electricity: buildContractCharges({ electricity: { pricingType: 'per_person', rate: 50_000 } }).electricity,
    })

    expect(fixed.lines.find(line => line.chargeType === 'electricity')?.amount).toBe(200_000)
    expect(perPerson.lines.find(line => line.chargeType === 'electricity')?.amount).toBe(150_000)
  })

  it('calculates water per_m3, per_person, and fixed_per_room modes', () => {
    const perM3 = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      water: buildContractCharges().water,
      readings: { water: buildUtilityReading({ current: { id: 'w-current', value: 18 }, previous: { id: 'w-prev', value: 10 } }) },
    })
    const perPerson = calculateDraftRule({
      period,
      contract: buildDraftContract({ occupantCount: 4 }),
      water: buildContractCharges({ water: { pricingType: 'per_person', rate: 40_000 } }).water,
    })
    const fixed = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      water: buildContractCharges({ water: { pricingType: 'fixed_per_room', rate: 120_000 } }).water,
    })

    expect(perM3.lines.find(line => line.chargeType === 'water')?.amount).toBe(120_000)
    expect(perPerson.lines.find(line => line.chargeType === 'water')?.amount).toBe(160_000)
    expect(fixed.lines.find(line => line.chargeType === 'water')?.amount).toBe(120_000)
  })

  it('prorates electricity per_person by contract start date', () => {
    // May 2026 = 31 days; contract starts 2026-05-20 → 12 billable days
    const result = calculateDraftRule({
      period,
      contract: buildDraftContract({ occupantCount: 3, startDate: '2026-05-20' }),
      electricity: buildContractCharges({ electricity: { pricingType: 'per_person', rate: 50_000 } }).electricity,
    })
    const line = result.lines.find(l => l.chargeType === 'electricity')
    expect(line?.amount).toBe(59_000) // roundUpToThousand(Math.round(3 * 50_000 * 12 / 31))
    expect(line?.metadata.billable_days).toBe(12)
    expect(line?.metadata.period_days).toBe(31)
  })

  it('prorates water per_person by contract start date', () => {
    // May 2026 = 31 days; contract starts 2026-05-20 → 12 billable days
    const result = calculateDraftRule({
      period,
      contract: buildDraftContract({ occupantCount: 4, startDate: '2026-05-20' }),
      water: buildContractCharges({ water: { pricingType: 'per_person', rate: 40_000 } }).water,
    })
    const line = result.lines.find(l => l.chargeType === 'water')
    expect(line?.amount).toBe(62_000) // roundUpToThousand(Math.round(4 * 40_000 * 12 / 31))
    expect(line?.metadata.billable_days).toBe(12)
    expect(line?.metadata.period_days).toBe(31)
  })

  it('uses handover fallback when no previous monthly reading exists', () => {
    const result = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      electricity: buildContractCharges().electricity,
      readings: {
        electricity: buildUtilityReading({
          previous: null,
          handover: { id: 'handover-reading', value: 80 },
          current: { id: 'current-reading', value: 100 },
        }),
      },
    })

    const line = result.lines.find(item => item.chargeType === 'electricity')
    expect(line?.quantity).toBe(20)
    expect(line?.metadata.source).toBe('handover_fallback')
    expect(result.warnings[0]?.code).toBe('handover_fallback_previous')
  })

  it('uses override billable usage for replacement and reset cases', () => {
    const replacement = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      electricity: buildContractCharges().electricity,
      readings: {
        electricity: buildUtilityReading({
          override: {
            id: 'override-1',
            previousReadingId: 'prev',
            previousReadingValue: 100,
            currentReadingId: 'curr',
            currentReadingValue: 5,
            oldMeterFinalValue: 130,
            newMeterStartValue: 0,
            billableUsage: 35,
            reason: 'replacement',
          },
        }),
      },
    })
    const reset = calculateDraftRule({
      period,
      contract: buildDraftContract(),
      water: buildContractCharges().water,
      readings: {
        water: buildUtilityReading({
          override: {
            id: 'override-2',
            previousReadingId: 'prev',
            previousReadingValue: 90,
            currentReadingId: 'curr',
            currentReadingValue: 10,
            oldMeterFinalValue: 100,
            newMeterStartValue: null,
            billableUsage: 20,
            reason: 'reset',
          },
        }),
      },
    })

    expect(replacement.lines.find(line => line.chargeType === 'electricity')?.quantity).toBe(35)
    expect(replacement.warnings[0]?.code).toBe('usage_override_applied')
    expect(reset.lines.find(line => line.chargeType === 'water')?.quantity).toBe(20)
  })
})
