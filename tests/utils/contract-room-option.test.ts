import { describe, expect, it } from 'vitest'
import { roomOptionLabel } from '~/utils/contracts/room-option'

describe('roomOptionLabel', () => {
  it('prefixes the building name so equal room numbers stay distinguishable', () => {
    expect(roomOptionLabel('101', 'QA V2 Flow Building')).toBe('QA V2 Flow Building · 101')
  })

  it('falls back to the room number while buildings are loading', () => {
    expect(roomOptionLabel('101', undefined)).toBe('101')
  })
})
