// Pure module without imports so scripts/*.mjs can load it through Node type stripping.

export interface AccrualFixedCost {
  amount: number
  effectiveFromPeriodYear: number
  effectiveFromPeriodMonth: number
  effectiveToPeriodYear: number | null
  effectiveToPeriodMonth: number | null
}

export interface AccrualExpense {
  amount: number
  fundedBy: string | null
}

export interface AccrualFormulaInput {
  periodYear: number
  periodMonth: number
  invoiceTotals: number[]
  fixedCosts: AccrualFixedCost[]
  expenses: AccrualExpense[]
  prepaidMonthlyAmounts: number[]
  reserveRatePercent: number
}

export interface AccrualFormulaResult {
  issuedRevenue: number
  fixedCostTotal: number
  directMonthlyExpenseTotal: number
  prepaidAllocationTotal: number
  totalExpense: number
  profitByRevenue: number
  reserveRatePercent: number
  accrualAmount: number
}

function ordinal(year: number, month: number): number {
  return year * 12 + month
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function fixedCostApplies(
  cost: AccrualFixedCost,
  periodYear: number,
  periodMonth: number,
): boolean {
  const period = ordinal(periodYear, periodMonth)
  const from = ordinal(cost.effectiveFromPeriodYear, cost.effectiveFromPeriodMonth)
  const to
    = cost.effectiveToPeriodYear != null && cost.effectiveToPeriodMonth != null
      ? ordinal(cost.effectiveToPeriodYear, cost.effectiveToPeriodMonth)
      : null
  return from <= period && (to == null || period <= to)
}

export function calculateAccrualAmount(profitByRevenue: number, reserveRatePercent: number): number {
  return Math.round((Math.max(profitByRevenue, 0) * reserveRatePercent) / 100)
}

export function computeAccrualFormula(input: AccrualFormulaInput): AccrualFormulaResult {
  const issuedRevenue = sum(input.invoiceTotals)
  const fixedCostTotal = sum(
    input.fixedCosts
      .filter(cost => fixedCostApplies(cost, input.periodYear, input.periodMonth))
      .map(cost => cost.amount),
  )
  const directMonthlyExpenseTotal = sum(
    input.expenses.filter(expense => expense.fundedBy !== 'reserve_fund').map(expense => expense.amount),
  )
  const prepaidAllocationTotal = sum(input.prepaidMonthlyAmounts)
  const totalExpense = fixedCostTotal + directMonthlyExpenseTotal + prepaidAllocationTotal
  const profitByRevenue = issuedRevenue - totalExpense
  return {
    issuedRevenue,
    fixedCostTotal,
    directMonthlyExpenseTotal,
    prepaidAllocationTotal,
    totalExpense,
    profitByRevenue,
    reserveRatePercent: input.reserveRatePercent,
    accrualAmount: calculateAccrualAmount(profitByRevenue, input.reserveRatePercent),
  }
}
