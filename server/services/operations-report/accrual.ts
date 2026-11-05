import type { H3Event } from 'h3'
import { OperationsReportRepository } from '../../repositories/operations-report/report'
import { computeAccrualFormula } from '../../utils/billing/accrual-formula'
import { ReserveFundService } from './reserve-funds'

export interface AccrualInputs {
  billingPeriodId: string | null
  issuedRevenue: number
  profitByRevenue: number
  reserveRatePercent: number
  accrualAmount: number
}

/** The single reserve-accrual formula shared by billing close, report close and admin refresh. */
export async function computeAccrualInputs(
  event: H3Event,
  buildingId: string,
  periodYear: number,
  periodMonth: number,
): Promise<AccrualInputs> {
  const snapshot = await OperationsReportRepository.fetchSnapshot(event, buildingId, periodYear, periodMonth)
  const rate = await ReserveFundService.findEffectiveRate(event, buildingId, periodYear, periodMonth)
  const result = computeAccrualFormula({
    periodYear,
    periodMonth,
    invoiceTotals: snapshot.billing.invoices.map(invoice => invoice.totalAmount),
    fixedCosts: snapshot.fixedCosts,
    expenses: snapshot.expenses,
    prepaidMonthlyAmounts: snapshot.prepaidItems.map(item => item.monthlyAmount),
    reserveRatePercent: rate?.reserveRatePercent ?? 0,
  })
  return {
    billingPeriodId: snapshot.billing.periodId,
    issuedRevenue: result.issuedRevenue,
    profitByRevenue: result.profitByRevenue,
    reserveRatePercent: result.reserveRatePercent,
    accrualAmount: result.accrualAmount,
  }
}
