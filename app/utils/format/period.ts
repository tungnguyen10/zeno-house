/**
 * Helpers for the `YYYY-MM` period string used by `UiDatePicker picker-mode="month"`.
 * Billing/reserve/fixed-cost APIs still take split `period_year` + `period_month`
 * integers, so forms model the period as a single string and split it on submit.
 */

export function formatPeriodString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function parsePeriodString(
  value: string | null | undefined,
): { year: number, month: number } | null {
  if (!value) return null
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}
