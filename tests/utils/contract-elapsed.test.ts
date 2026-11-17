import { describe, expect, it } from 'vitest'
import { fullMonthsElapsed } from '~/utils/contracts/elapsed'

describe('fullMonthsElapsed', () => {
  it('is 0 on the start day and during the first month', () => {
    expect(fullMonthsElapsed('2026-11-17', new Date('2026-11-17T08:00:00'))).toBe(0)
    expect(fullMonthsElapsed('2026-11-17', new Date('2026-12-16T08:00:00'))).toBe(0)
  })

  it('counts a month only once the same day of the next month is reached', () => {
    expect(fullMonthsElapsed('2026-11-17', new Date('2026-12-17T08:00:00'))).toBe(1)
    expect(fullMonthsElapsed('2026-11-17', new Date('2027-01-16T08:00:00'))).toBe(1)
  })

  it('treats a month-end start as completed on the last day of a shorter month', () => {
    expect(fullMonthsElapsed('2026-01-31', new Date('2026-02-28T08:00:00'))).toBe(1)
  })

  it('never goes negative for a contract that has not started', () => {
    expect(fullMonthsElapsed('2027-01-01', new Date('2026-11-17T08:00:00'))).toBe(0)
  })
})
