import { findIssuanceBlockers } from '../../../server/services/billing/rules'

describe('issuance blocker rules', () => {
  it('blocks missing electricity reading', () => {
    const blockers = findIssuanceBlockers([
      {
        contractId: 'contract-1',
        roomId: 'room-1',
        requiredMeterTypes: ['electricity'],
        readings: [],
      },
    ])

    expect(blockers[0]).toMatchObject({
      code: 'missing_current_reading',
      message: expect.stringContaining('điện'),
    })
  })

  it('blocks unresolved override', () => {
    const blockers = findIssuanceBlockers([
      {
        contractId: 'contract-1',
        roomId: 'room-1',
        requiredMeterTypes: ['electricity'],
        readings: [{ meterType: 'electricity', currentReadingId: 'reading-1', requiresOverride: true }],
      },
    ])

    expect(blockers).toHaveLength(1)
  })

  it('blocks empty override reason', () => {
    const blockers = findIssuanceBlockers([
      {
        contractId: 'contract-1',
        roomId: 'room-1',
        requiredMeterTypes: ['water'],
        readings: [{ meterType: 'water', currentReadingId: 'reading-1', override: { id: 'override-1', reason: '   ' } }],
      },
    ])

    expect(blockers[0]?.message).toContain('lý do')
  })

  it('returns empty list when all readings are clear', () => {
    const blockers = findIssuanceBlockers([
      {
        contractId: 'contract-1',
        roomId: 'room-1',
        requiredMeterTypes: ['electricity', 'water'],
        readings: [
          { meterType: 'electricity', currentReadingId: 'reading-1' },
          { meterType: 'water', currentReadingId: 'reading-2' },
        ],
      },
    ])

    expect(blockers).toEqual([])
  })
})
