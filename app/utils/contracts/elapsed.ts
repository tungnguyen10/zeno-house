import dayjs from 'dayjs'

/** Whole months between the contract start date and `now` (0 until the first month completes). */
export function fullMonthsElapsed(startDate: string, now: Date = new Date()): number {
  return Math.max(0, dayjs(now).diff(dayjs(startDate), 'month'))
}
