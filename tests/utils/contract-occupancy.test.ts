import { describe, expect, it } from 'vitest'
import { countActiveResidents } from '~/utils/contracts/occupancy'

const occ = (role: 'primary' | 'roommate', moveOutDate: string | null = null) => ({ role, moveOutDate })

describe('countActiveResidents', () => {
  it('counts the primary tenant plus roommates who have not moved out', () => {
    expect(countActiveResidents([occ('roommate'), occ('roommate', '2026-11-01')])).toBe(2)
  })

  it('is 1 when there are no roommates', () => {
    expect(countActiveResidents([])).toBe(1)
  })

  it('does not double count a primary row if the list contains one', () => {
    expect(countActiveResidents([occ('primary'), occ('roommate')])).toBe(2)
  })
})
