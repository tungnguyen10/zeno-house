import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const append = vi.fn()
const appendMany = vi.fn()

vi.mock('../../server/repositories/audit', () => ({
  AuditRepository: { append, appendMany },
}))

describe('AuditService.appendBulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    append.mockResolvedValue({ id: 'parent-1' })
    appendMany.mockResolvedValue([])
  })

  it('persists successful child audit rows with one batch insert', async () => {
    const { AuditService } = await import('../../server/services/audit')

    await AuditService.appendBulk({} as never, { id: 'user-1' } as AuthUser, {
      building_id: 'building-1',
      entity_type: 'room',
      aggregate_action: 'rooms.bulk_archived',
      items: [
        { entity_id: 'room-1', action: 'room.archived' },
        { entity_id: 'room-2', action: 'room.archived' },
      ],
      succeeded: ['room-1', 'room-2'],
      total: 2,
      failed: 0,
    })

    expect(append).toHaveBeenCalledTimes(1)
    expect(appendMany).toHaveBeenCalledTimes(1)
    expect(appendMany).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ entity_id: 'room-1', correlation_id: 'parent-1' }),
      expect.objectContaining({ entity_id: 'room-2', correlation_id: 'parent-1' }),
    ])
  })
  })
