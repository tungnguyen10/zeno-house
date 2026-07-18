import { describe, expect, it } from 'vitest'
import { formatCurrencyCompact, formatCurrencyNumber } from '../../app/utils/format/currency'

describe('formatCurrencyNumber', () => {
  it('formats the VND figure without baking the currency unit into it', () => {
    expect(formatCurrencyNumber(1_250_000)).toBe('1.250.000')
  })
})

describe('formatCurrencyCompact', () => {
  it('returns plain digits for amounts < 1000', () => {
    expect(formatCurrencyCompact(0)).toBe('0')
    expect(formatCurrencyCompact(999)).toBe('999')
  })

  it('uses "N" (nghìn) for amounts in [1k, 1M)', () => {
    expect(formatCurrencyCompact(1_000)).toBe('1 N')
    expect(formatCurrencyCompact(999_000)).toBe('999 N')
  })

  it('uses "tr" (triệu) for amounts in [1M, 1B)', () => {
    expect(formatCurrencyCompact(1_000_000)).toBe('1 tr')
    expect(formatCurrencyCompact(120_000_000)).toBe('120 tr')
    expect(formatCurrencyCompact(1_500_000)).toBe('1.5 tr')
  })

  it('uses "tỷ" for amounts ≥ 1B', () => {
    expect(formatCurrencyCompact(1_000_000_000)).toBe('1 tỷ')
    expect(formatCurrencyCompact(1_500_000_000)).toBe('1.5 tỷ')
  })

  it('handles negative amounts', () => {
    expect(formatCurrencyCompact(-1_500_000)).toBe('-1.5 tr')
  })
})
