import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchSnapshot = vi.fn()
const findEffectiveRate = vi.fn()

vi.mock('../../../server/repositories/operations-report/report', () => ({
  OperationsReportRepository: { fetchSnapshot },
}))
vi.mock('../../../server/services/operations-report/reserve-funds', () => ({
  ReserveFundService: { findEffectiveRate },
}))

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    billing: {
      periodId: 'period-1',
      periodStatus: 'collecting',
      invoices: [
        { id: 'i1', totalAmount: 3_000_000, balanceAmount: 0, collected: 3_000_000, charges: [] },
        { id: 'i2', totalAmount: 2_000_000, balanceAmount: 0, collected: 2_000_000, charges: [] },
      ],
    },
    fixedCosts: [],
    expenses: [],
    prepaidItems: [],
    ...overrides,
  }
}

function fixedCost(overrides: Record<string, unknown> = {}) {
  return {
    amount: 1_000_000,
    effectiveFromPeriodYear: 2026,
    effectiveFromPeriodMonth: 1,
    effectiveToPeriodYear: null,
    effectiveToPeriodMonth: null,
    ...overrides,
  }
}

async function compute() {
  const { computeAccrualInputs } = await import('../../../server/services/operations-report/accrual')
  return computeAccrualInputs({} as never, 'building-1', 2026, 10)
}

describe('computeAccrualInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findEffectiveRate.mockResolvedValue({ reserveRatePercent: 10 })
  })

  it('reads the billing period id and revenue from the snapshot', async () => {
    fetchSnapshot.mockResolvedValue(snapshot())
    await expect(compute()).resolves.toEqual({
      billingPeriodId: 'period-1',
      issuedRevenue: 5_000_000,
      profitByRevenue: 5_000_000,
      reserveRatePercent: 10,
      accrualAmount: 500_000,
    })
    expect(fetchSnapshot).toHaveBeenCalledWith(expect.anything(), 'building-1', 2026, 10)
    expect(findEffectiveRate).toHaveBeenCalledWith(expect.anything(), 'building-1', 2026, 10)
  })

  it('excludes reserve-fund-funded expenses', async () => {
    fetchSnapshot.mockResolvedValue(snapshot({
      expenses: [
        { amount: 400_000, fundedBy: 'direct' },
        { amount: 1_500_000, fundedBy: 'reserve_fund' },
      ],
    }))
    const result = await compute()
    expect(result.profitByRevenue).toBe(4_600_000)
    expect(result.accrualAmount).toBe(460_000)
  })

  it('applies fixed costs only inside their effective range', async () => {
    fetchSnapshot.mockResolvedValue(snapshot({
      fixedCosts: [
        fixedCost(),
        fixedCost({ amount: 9_000_000, effectiveFromPeriodMonth: 11 }),
        fixedCost({ amount: 8_000_000, effectiveToPeriodYear: 2026, effectiveToPeriodMonth: 9 }),
      ],
    }))
    expect((await compute()).profitByRevenue).toBe(4_000_000)
  })

  it('subtracts prepaid monthly allocations', async () => {
    fetchSnapshot.mockResolvedValue(snapshot({
      prepaidItems: [{ monthlyAmount: 250_000 }, { monthlyAmount: 750_000 }],
    }))
    expect((await compute()).profitByRevenue).toBe(4_000_000)
  })

  it('returns zero accrual for negative profit', async () => {
    fetchSnapshot.mockResolvedValue(snapshot({
      fixedCosts: [fixedCost({ amount: 9_000_000 })],
    }))
    const result = await compute()
    expect(result.profitByRevenue).toBe(-4_000_000)
    expect(result.accrualAmount).toBe(0)
  })

  it('uses rate 0 when no effective rate exists', async () => {
    fetchSnapshot.mockResolvedValue(snapshot())
    findEffectiveRate.mockResolvedValue(null)
    const result = await compute()
    expect(result.reserveRatePercent).toBe(0)
    expect(result.accrualAmount).toBe(0)
  })

  it('returns a null billing period id when the month has no billing period', async () => {
    fetchSnapshot.mockResolvedValue(snapshot({
      billing: { periodId: null, periodStatus: null, invoices: [] },
    }))
    const result = await compute()
    expect(result.billingPeriodId).toBeNull()
    expect(result.issuedRevenue).toBe(0)
  })
})
