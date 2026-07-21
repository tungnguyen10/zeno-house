import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuditRepository,
  decodeAuditCursor,
  encodeAuditCursor,
} from '../../../server/repositories/audit'

const query = vi.hoisted(() => {
  const value: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'or', 'lt', 'order']) {
    value[method] = vi.fn(() => value)
  }
  value.limit = vi.fn()
  return value
})
const from = vi.hoisted(() => vi.fn(() => query))

vi.mock('../../../server/utils/db', () => ({
  db: vi.fn(() => ({ from })),
}))

vi.stubGlobal('throwDbError', (error: unknown) => { throw error })

const row = (id: string, createdAt: string) => ({
  id,
  building_id: 'building-1',
  actor_id: 'actor-1',
  action: 'room.updated',
  entity_type: 'room',
  entity_id: id,
  correlation_id: null,
  before_data: null,
  after_data: null,
  metadata: {},
  created_at: createdAt,
})

describe('shared audit stable cursor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('round-trips the timestamp and id tie-breaker', () => {
    const event = { id: 'event-1', createdAt: '2026-07-21T04:30:00.000Z' }
    expect(decodeAuditCursor(encodeAuditCursor(event as never))).toEqual({
      createdAt: event.createdAt,
      id: event.id,
    })
  })

  it('orders by timestamp and id and returns a cursor only when another row exists', async () => {
    query.limit.mockResolvedValue({
      data: [
        row('event-3', '2026-07-21T04:30:00.000Z'),
        row('event-2', '2026-07-21T04:30:00.000Z'),
        row('event-1', '2026-07-21T04:29:00.000Z'),
      ],
      error: null,
      count: 3,
    })

    const result = await AuditRepository.listAll({ context: {} } as never, { limit: 2 })

    expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false })
    expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(3)
    expect(result.items.map(item => item.id)).toEqual(['event-3', 'event-2'])
    expect(result.nextCursor).toBe('2026-07-21T04:30:00.000Z|event-2')
  })

  it('applies the compound cursor before loading the next page', async () => {
    query.limit.mockResolvedValue({ data: [], error: null, count: 0 })

    await AuditRepository.listAll({ context: {} } as never, {
      cursor: '2026-07-21T04:30:00.000Z|event-2',
      limit: 2,
    })

    expect(query.or).toHaveBeenCalledWith(
      'created_at.lt.2026-07-21T04:30:00.000Z,and(created_at.eq.2026-07-21T04:30:00.000Z,id.lt.event-2)',
    )
  })

  it('keeps the full filtered total when loading a cursor page', async () => {
    const countQuery: Record<string, unknown> = {}
    countQuery.select = vi.fn(() => countQuery)
    countQuery.eq = vi.fn(() => countQuery)
    countQuery.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
      count: 80,
      error: null,
    }))
    from.mockReturnValueOnce(countQuery as never).mockReturnValueOnce(query)
    query.limit.mockResolvedValue({ data: [], error: null })

    const result = await AuditRepository.listAll({ context: {} } as never, {
      cursor: '2026-07-21T04:30:00.000Z|event-2',
      entityType: 'room',
      limit: 2,
    })

    expect(result.total).toBe(80)
    expect(countQuery).not.toHaveProperty('or')
  })
})
