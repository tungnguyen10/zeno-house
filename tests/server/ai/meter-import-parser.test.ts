import { describe, expect, it } from 'vitest'
import { aiToolPreviewMeterImportSchema } from '~/utils/validators/ai'
import { parseMeterImportMessage } from '../../../server/services/ai/meter-import-parser'

describe('AI meter import parser', () => {
  it('preserves exact numeric values from a Vietnamese TSV block', () => {
    const result = parseMeterImportMessage('Nhập tháng này:\nPhòng\tĐiện\tNước\n101\t1250.5\t38\n102\t0\t4.25')

    expect(result.issues).toEqual([])
    expect(result.rows).toEqual([
      { line: 3, roomReference: '101', electricity: 1250.5, water: 38 },
      { line: 4, roomReference: '102', electricity: 0, water: 4.25 },
    ])
  })

  it('supports semicolon headers and reports line-specific invalid values', () => {
    const result = parseMeterImportMessage('room;electricity;water\nA1;1,25;-4')

    expect(result.rows).toEqual([{ line: 2, roomReference: 'A1' }])
    expect(result.issues).toEqual([
      expect.objectContaining({ line: 2, field: 'electricity', code: 'invalid_number' }),
      expect.objectContaining({ line: 2, field: 'water', code: 'invalid_number' }),
      expect.objectContaining({ line: 2, field: 'row', code: 'missing_reading' }),
    ])
  })

  it('requires a supported header and never guesses prose numbers', () => {
    const result = parseMeterImportMessage('Phòng 101 điện 1200 nước 30')
    expect(result.rows).toEqual([])
    expect(result.issues).toEqual([expect.objectContaining({ code: 'missing_header' })])
  })

  it('does not allow the model to pass raw text or reconstructed reading arrays to the tool', () => {
    const parsed = aiToolPreviewMeterImportSchema.safeParse({
      building_ref: 'Zeno Central',
      period_year: 2026,
      period_month: 7,
      reading_date: '2026-07-31',
      raw_text: '101,1,2',
      readings: [{ room_id: '101', electricity: 1 }],
    })
    expect(parsed.success).toBe(false)
  })
})
