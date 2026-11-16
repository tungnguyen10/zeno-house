import { describe, expect, it } from 'vitest'
import { vndToWords } from '~/utils/format/vnd-words'

describe('vndToWords', () => {
  it.each([
    [0, 'Không đồng'],
    [5, 'Năm đồng'],
    [15, 'Mười lăm đồng'],
    [21, 'Hai mươi mốt đồng'],
    [24, 'Hai mươi tư đồng'],
    [105, 'Một trăm lẻ năm đồng'],
    [1_000, 'Một nghìn đồng'],
    [1_005, 'Một nghìn không trăm lẻ năm đồng'],
    [1_500_000, 'Một triệu năm trăm nghìn đồng'],
    [3_000_000, 'Ba triệu đồng'],
    [10_250_000, 'Mười triệu hai trăm năm mươi nghìn đồng'],
    [1_000_000_000, 'Một tỷ đồng'],
  ])('%d → %s', (n, text) => {
    expect(vndToWords(n)).toBe(text)
  })

  it('rejects negatives and fractions', () => {
    expect(() => vndToWords(-1)).toThrow()
    expect(() => vndToWords(1.5)).toThrow()
  })
})
