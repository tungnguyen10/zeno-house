import { describe, expect, it } from 'vitest'
import { currentVietnamPeriod } from '../../app/utils/format/period'

describe('period formatting', () => {
  it('resolves the current period in Asia/Ho_Chi_Minh at a UTC month boundary', () => {
    expect(currentVietnamPeriod(new Date('2026-07-31T17:30:00Z'))).toBe('2026-08')
  })
})
