/**
 * Helpers for the `YYYY-MM` period string used by `UiDatePicker picker-mode="month"`.
 * Billing/reserve/fixed-cost APIs still take split `period_year` + `period_month`
 * integers, so forms model the period as a single string and split it on submit.
 */

export function formatPeriodString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Resolve the current `YYYY-MM` period in Vietnam, independent of the host timezone. */
export function currentVietnamPeriod(at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(at)
  const year = parts.find(part => part.type === 'year')!.value
  const month = parts.find(part => part.type === 'month')!.value
  return `${year}-${month}`
}

export function parsePeriodString(
  value: string | null | undefined,
): { year: number, month: number } | null {
  if (!value) return null
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

/** Format a `YYYY-MM` period string as "Tháng M/YYYY" (e.g. "Tháng 7/2026"). */
export function formatPeriodDisplay(period: string | null | undefined): string | null {
  if (!period) return null
  const parsed = parsePeriodString(period)
  if (!parsed) return null
  return `Tháng ${parsed.month}/${parsed.year}`
}
