import { describe, expect, it } from 'vitest'
import { generateRoomNumbers } from '~/utils/rooms/generate-room-numbers'

const base = { floorFrom: 1, floorTo: 3, roomsPerFloor: 2, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
const numbers = (input: Partial<typeof base>) => generateRoomNumbers({ ...base, ...input }).rooms.map(r => `${r.floor}:${r.roomNumber}`)

describe('generateRoomNumbers', () => {
  it('embeds floor with 2-digit sequence', () => {
    expect(numbers({})).toEqual(['1:P101', '1:P102', '2:P201', '2:P202', '3:P301', '3:P302'])
  })

  it('separates name floor from stored floor (ground floor = 0xx)', () => {
    expect(numbers({ prefix: '', nameFloorStart: 0 })).toEqual(['1:001', '1:002', '2:101', '2:102', '3:201', '3:202'])
  })

  it('respects start sequence', () => {
    expect(numbers({ floorTo: 1, startSeq: 5 })).toEqual(['1:P105', '1:P106'])
  })

  it('without floor in name, sequence runs across floors with min 2 digits', () => {
    expect(numbers({ includeFloor: false, floorTo: 2, roomsPerFloor: 3 })).toEqual(['1:P01', '1:P02', '1:P03', '2:P04', '2:P05', '2:P06'])
    expect(numbers({ includeFloor: false, floorTo: 1, roomsPerFloor: 2, startSeq: 101 })).toEqual(['1:P101', '1:P102'])
  })

  it.each([
    [{ floorFrom: 3, floorTo: 1 }, 'floor_range'],
    [{ floorTo: 101 }, 'floor_range'],
    [{ roomsPerFloor: 100 }, 'rooms_per_floor'],
    [{ roomsPerFloor: 0 }, 'rooms_per_floor'],
    [{ startSeq: 95, roomsPerFloor: 10 }, 'seq_overflow'],
    [{ floorTo: 21, roomsPerFloor: 10 }, 'too_many'],
  ])('reports %j as %s', (input, error) => {
    const r = generateRoomNumbers({ ...base, ...input })
    expect(r.error).toBe(error)
    expect(r.rooms).toEqual([])
  })
})
