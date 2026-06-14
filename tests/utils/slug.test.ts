import { describe, expect, it } from 'vitest'
import { isUuid, slugifyName } from '../../app/utils/format/slug'

describe('slug formatting', () => {
  it('normalizes names into URL slugs', () => {
    expect(slugifyName('Toa A - Tang 1')).toBe('toa-a-tang-1')
    expect(slugifyName('  Building @ Main  ')).toBe('building-main')
  })

  it('detects UUID identifiers for id-or-slug lookup', () => {
    expect(isUuid('20000000-0000-4000-8000-000000000001')).toBe(true)
    expect(isUuid('toa-a')).toBe(false)
  })
})
