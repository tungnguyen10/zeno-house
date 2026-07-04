import { describe, expect, it } from 'vitest'
import { auditDiffRows } from '../../app/utils/audit/display'

describe('audit display helpers', () => {
  it('formats contract monthly rent diffs as readable currency rows', () => {
    const rows = auditDiffRows(
      { monthlyRent: 4_000_000, status: 'active', updatedAt: '2026-07-01T00:00:00Z' },
      { monthlyRent: 4_500_000, status: 'active', updatedAt: '2026-07-02T00:00:00Z' },
      'contract',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: 'monthlyRent',
      label: 'Giá thuê / tháng',
      beforeText: '4.000.000\u00a0\u20ab',
      afterText: '4.500.000\u00a0\u20ab',
    })
  })

  it('omits technical timestamp fields from readable diffs', () => {
    const rows = auditDiffRows(
      { updatedAt: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
      { updatedAt: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z' },
      'contract',
    )

    expect(rows).toEqual([])
  })
})
