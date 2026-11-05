/** Calendar arithmetic for ISO dates, independent of the browser timezone. */
export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function formatDateOnlyVi(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('vi-VN', { timeZone: 'UTC' })
}
