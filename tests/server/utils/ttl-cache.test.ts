import { describe, expect, it } from 'vitest'
import { TtlCache } from '../../../server/utils/ttl-cache'

describe('TtlCache', () => {
  it('expires values and supports explicit invalidation', () => {
    const cache = new TtlCache<number>()
    cache.set('a', 1, 20, 100)
    cache.set('b', 2, 20, 100)

    expect(cache.get('a', 119)).toBe(1)
    expect(cache.get('a', 120)).toBeUndefined()
    cache.deleteMatching(key => key === 'b')
    expect(cache.get('b', 110)).toBeUndefined()
  })
})
