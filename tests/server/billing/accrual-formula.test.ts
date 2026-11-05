import { describe, expect, it } from 'vitest'
import {
  calculateAccrualAmount,
  computeAccrualFormula,
  fixedCostApplies,
  type AccrualFixedCost,
} from '../../../server/utils/billing/accrual-formula'

const base = {
  periodYear: 2026,
  periodMonth: 10,
  invoiceTotals: [] as number[],
  fixedCosts: [] as AccrualFixedCost[],
  expenses: [] as Array<{ amount: number, fundedBy: string | null }>,
  prepaidMonthlyAmounts: [] as number[],
  reserveRatePercent: 0,
}

function fixedCost(overrides: Partial<AccrualFixedCost> = {}): AccrualFixedCost {
  return {
    amount: 100_000,
    effectiveFromPeriodYear: 2026,
    effectiveFromPeriodMonth: 10,
    effectiveToPeriodYear: null,
    effectiveToPeriodMonth: null,
    ...overrides,
  }
}

describe('fixedCostApplies', () => {
  it('applies in its first and last effective month inclusive', () => {
    const cost = fixedCost({ effectiveToPeriodYear: 2026, effectiveToPeriodMonth: 10 })
    expect(fixedCostApplies(cost, 2026, 10)).toBe(true)
    expect(fixedCostApplies(cost, 2026, 9)).toBe(false)
    expect(fixedCostApplies(cost, 2026, 11)).toBe(false)
  })

  it('applies to every later month when open-ended', () => {
    const cost = fixedCost()
    expect(fixedCostApplies(cost, 2027, 3)).toBe(true)
    expect(fixedCostApplies(cost, 2026, 9)).toBe(false)
  })
})

describe('calculateAccrualAmount', () => {
  it('rounds half up and clamps negative profit to zero', () => {
    expect(calculateAccrualAmount(10, 5)).toBe(1)
    expect(calculateAccrualAmount(1_000_000, 10)).toBe(100_000)
    expect(calculateAccrualAmount(-500, 10)).toBe(0)
  })
})

describe('computeAccrualFormula', () => {
  it('excludes reserve-fund-funded expenses from profit', () => {
    const result = computeAccrualFormula({
      ...base,
      invoiceTotals: [1_000_000, 500_000],
      reserveRatePercent: 10,
      expenses: [
        { amount: 200_000, fundedBy: 'direct' },
        { amount: 900_000, fundedBy: 'reserve_fund' },
      ],
    })
    expect(result.directMonthlyExpenseTotal).toBe(200_000)
    expect(result.profitByRevenue).toBe(1_300_000)
    expect(result.accrualAmount).toBe(130_000)
  })

  it('subtracts applicable fixed costs and prepaid allocations only', () => {
    const result = computeAccrualFormula({
      ...base,
      invoiceTotals: [1_000_000],
      reserveRatePercent: 10,
      fixedCosts: [
        fixedCost({ amount: 100_000 }),
        fixedCost({ amount: 999_999, effectiveFromPeriodMonth: 11 }),
      ],
      prepaidMonthlyAmounts: [50_000, 25_000],
    })
    expect(result.fixedCostTotal).toBe(100_000)
    expect(result.prepaidAllocationTotal).toBe(75_000)
    expect(result.totalExpense).toBe(175_000)
    expect(result.profitByRevenue).toBe(825_000)
    expect(result.accrualAmount).toBe(82_500)
  })

  it('returns zero accrual for negative profit', () => {
    const result = computeAccrualFormula({
      ...base,
      invoiceTotals: [100],
      expenses: [{ amount: 500, fundedBy: null }],
      reserveRatePercent: 50,
    })
    expect(result.profitByRevenue).toBe(-400)
    expect(result.accrualAmount).toBe(0)
  })

  it('returns zero accrual when the reserve rate is zero', () => {
    const result = computeAccrualFormula({ ...base, invoiceTotals: [1_000_000] })
    expect(result.issuedRevenue).toBe(1_000_000)
    expect(result.accrualAmount).toBe(0)
  })

  it('returns all zeros for empty input', () => {
    expect(computeAccrualFormula(base)).toEqual({
      issuedRevenue: 0,
      fixedCostTotal: 0,
      directMonthlyExpenseTotal: 0,
      prepaidAllocationTotal: 0,
      totalExpense: 0,
      profitByRevenue: 0,
      reserveRatePercent: 0,
      accrualAmount: 0,
    })
  })
})
