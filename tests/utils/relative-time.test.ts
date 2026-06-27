import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '../../app/utils/format/relative-time'

const REFERENCE_NOW = new Date('2026-06-27T10:00:00Z')

describe('formatRelativeTime', () => {
  it('returns empty string for null/undefined/invalid input', () => {
    expect(formatRelativeTime(null, REFERENCE_NOW)).toBe('')
    expect(formatRelativeTime(undefined, REFERENCE_NOW)).toBe('')
    expect(formatRelativeTime('not-a-date', REFERENCE_NOW)).toBe('')
  })

  it('returns "Vừa cập nhật" when diff < 60s', () => {
    expect(formatRelativeTime('2026-06-27T10:00:00Z', REFERENCE_NOW)).toBe('Vừa cập nhật')
    expect(formatRelativeTime('2026-06-27T09:59:01Z', REFERENCE_NOW)).toBe('Vừa cập nhật')
  })

  it('treats future timestamps as "Vừa cập nhật"', () => {
    expect(formatRelativeTime('2026-06-27T10:05:00Z', REFERENCE_NOW)).toBe('Vừa cập nhật')
  })

  it('returns minutes for diff in [1m, 60m)', () => {
    expect(formatRelativeTime('2026-06-27T09:59:00Z', REFERENCE_NOW)).toBe('1 phút trước')
    expect(formatRelativeTime('2026-06-27T09:01:00Z', REFERENCE_NOW)).toBe('59 phút trước')
  })

  it('returns hours for diff in [1h, 24h)', () => {
    expect(formatRelativeTime('2026-06-27T09:00:00Z', REFERENCE_NOW)).toBe('1 giờ trước')
    expect(formatRelativeTime('2026-06-26T11:00:00Z', REFERENCE_NOW)).toBe('23 giờ trước')
  })

  it('falls back to date+time for diff ≥ 24h (DD/MM HH:mm)', () => {
    const result = formatRelativeTime('2026-06-26T10:00:00Z', REFERENCE_NOW)
    expect(result).toMatch(/^\d{2}\/\d{2},?\s+\d{2}:\d{2}$/)
    expect(result).toContain('26/06')
  })

  it('uses date+time fallback for week-old timestamps', () => {
    const result = formatRelativeTime('2026-06-20T10:00:00Z', REFERENCE_NOW)
    expect(result).toContain('20/06')
  })
})
