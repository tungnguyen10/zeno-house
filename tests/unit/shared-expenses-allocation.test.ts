import { describe, expect, it } from 'vitest'
import { buildSharedExpenseAllocationPreview } from '../../app/utils/shared-expenses/allocation'

describe('buildSharedExpenseAllocationPreview', () => {
  it('preserves the total and assigns the rounding remainder to the last building', () => {
    expect(buildSharedExpenseAllocationPreview(1_001, ['building-1', 'building-2'])).toEqual([
      { buildingId: 'building-1', amount: 500 },
      { buildingId: 'building-2', amount: 501 },
    ])
  })

  it('returns no preview when the amount or building membership is missing', () => {
    expect(buildSharedExpenseAllocationPreview(0, ['building-1'])).toEqual([])
    expect(buildSharedExpenseAllocationPreview(1_001, [])).toEqual([])
  })
})
