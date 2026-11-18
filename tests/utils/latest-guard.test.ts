import { describe, expect, it } from 'vitest'
import { createLatestGuard } from '~/utils/contracts/latest-guard'

describe('createLatestGuard', () => {
  it('reports the newest call as current', () => {
    const guard = createLatestGuard()
    const first = guard()
    expect(first()).toBe(true)
  })

  it('marks an earlier call stale once a later call starts', () => {
    const guard = createLatestGuard()
    const first = guard()
    const second = guard()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  it('keeps independent guards isolated', () => {
    const rooms = createLatestGuard()
    const buildings = createLatestGuard()
    const room = rooms()
    buildings()
    expect(room()).toBe(true)
  })

  it('ignores a slow response for room A after switching to room B', async () => {
    const guard = createLatestGuard()
    const applied: string[] = []
    const load = async (room: string, delayMs: number) => {
      const isLatest = guard()
      await new Promise(resolve => setTimeout(resolve, delayMs))
      if (!isLatest()) return
      applied.push(room)
    }
    await Promise.all([load('A', 20), load('B', 1)])
    expect(applied).toEqual(['B'])
  })
})
