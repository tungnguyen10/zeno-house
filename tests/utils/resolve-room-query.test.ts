import { describe, expect, it, vi } from 'vitest'
import { resolveRoomQuery } from '~/utils/contracts/resolve-room-query'

const UUID = '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'

describe('resolveRoomQuery', () => {
  it('keeps a uuid without fetching', async () => {
    const fetchRoom = vi.fn()
    expect(await resolveRoomQuery(UUID, fetchRoom)).toBe(UUID)
    expect(fetchRoom).not.toHaveBeenCalled()
  })

  it('resolves a room code', async () => {
    expect(await resolveRoomQuery('zeno-p101', async () => ({ id: UUID }))).toBe(UUID)
  })

  it('returns empty for unknown code or errors', async () => {
    expect(await resolveRoomQuery('nope', async () => null)).toBe('')
    expect(await resolveRoomQuery('boom', async () => { throw new Error('x') })).toBe('')
  })

  it('returns empty for missing/array values', async () => {
    expect(await resolveRoomQuery(undefined, vi.fn())).toBe('')
    expect(await resolveRoomQuery(['a', 'b'], vi.fn())).toBe('')
  })
})
