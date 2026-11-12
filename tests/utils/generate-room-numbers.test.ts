import { describe, expect, it } from 'vitest'
import { generateRoomNumbers, type RoomGeneratorInput } from '~/utils/rooms/generate-room-numbers'
import { quickRoomSchema } from '~/utils/validators/buildings'

const base: RoomGeneratorInput = { floorFrom: 1, floorTo: 3, roomsPerFloor: 2, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
const numbers = (input: Partial<RoomGeneratorInput>) => generateRoomNumbers({ ...base, ...input }).rooms.map(r => `${r.floor}:${r.roomNumber}`)

describe('generateRoomNumbers', () => {
  it('embeds floor with two-digit sequence', () => {
    expect(numbers({})).toEqual(['1:P101', '1:P102', '2:P201', '2:P202', '3:P301', '3:P302'])
  })

  it('separates name floor from stored floor, including ground-floor names', () => {
    expect(numbers({ prefix: '', nameFloorStart: 0 })).toEqual(['1:001', '1:002', '2:101', '2:102', '3:201', '3:202'])
  })

  it('respects start sequence including zero', () => {
    expect(numbers({ floorTo: 1, startSeq: 5 })).toEqual(['1:P105', '1:P106'])
    expect(numbers({ floorTo: 1, startSeq: 0 })).toEqual(['1:P100', '1:P101'])
  })

  it('runs a continuous sequence across floors without floor names, with at least two digits', () => {
    expect(numbers({ includeFloor: false, floorTo: 2, roomsPerFloor: 3 })).toEqual(['1:P01', '1:P02', '1:P03', '2:P04', '2:P05', '2:P06'])
    expect(numbers({ includeFloor: false, floorTo: 1, startSeq: 101 })).toEqual(['1:P101', '1:P102'])
  })

  it.each([
    [{ floorFrom: 3, floorTo: 1 }, 'floor_range'],
    [{ floorFrom: 0 }, 'floor_range'],
    [{ floorTo: 101 }, 'floor_range'],
    [{ floorFrom: 1.5 }, 'floor_range'],
    [{ floorTo: NaN }, 'floor_range'],
    [{ roomsPerFloor: 100 }, 'rooms_per_floor'],
    [{ roomsPerFloor: 0 }, 'rooms_per_floor'],
    [{ roomsPerFloor: 1.5 }, 'rooms_per_floor'],
    [{ roomsPerFloor: Infinity }, 'rooms_per_floor'],
    [{ startSeq: 95, roomsPerFloor: 10 }, 'seq_overflow'],
    [{ floorTo: 21, roomsPerFloor: 10 }, 'too_many'],
    [{ prefix: 'A'.repeat(11) }, 'invalid_input'],
    [{ startSeq: -1 }, 'invalid_input'],
    [{ startSeq: 1.5 }, 'invalid_input'],
    [{ startSeq: NaN }, 'invalid_input'],
    [{ startSeq: Infinity }, 'invalid_input'],
    [{ startSeq: Number.MAX_SAFE_INTEGER + 1 }, 'invalid_input'],
    [{ nameFloorStart: -1 }, 'invalid_input'],
    [{ nameFloorStart: 1.5 }, 'invalid_input'],
    [{ nameFloorStart: NaN }, 'invalid_input'],
    [{ nameFloorStart: Number.MAX_SAFE_INTEGER + 1 }, 'invalid_input'],
    [{ nameFloorStart: Number.MAX_SAFE_INTEGER }, 'invalid_input'],
    [{ includeFloor: false, startSeq: Number.MAX_SAFE_INTEGER }, 'invalid_input'],
    [{ includeFloor: false, floorTo: 1, roomsPerFloor: 3, startSeq: Number.MAX_SAFE_INTEGER - 1 }, 'invalid_input'],
    [{ nameFloorStart: Number.MAX_SAFE_INTEGER - 1 }, 'invalid_input'],
    [{ prefix: 'A'.repeat(10), nameFloorStart: 100_000_000 }, 'invalid_input'],
    [{ prefix: 'A'.repeat(10), includeFloor: false, startSeq: 10_000_000_000 }, 'invalid_input'],
  ] satisfies [Partial<RoomGeneratorInput>, string][])('rejects %j as %s without partial output', (input, error) => {
    expect(generateRoomNumbers({ ...base, ...input })).toEqual({ rooms: [], error })
  })

  it('accepts the exact 200-room limit and maximum floor', () => {
    const result = generateRoomNumbers({ ...base, floorFrom: 97, floorTo: 100, roomsPerFloor: 50 })
    expect(result.error).toBeNull()
    expect(result.rooms).toHaveLength(200)
    expect(result.rooms.at(-1)).toEqual({ roomNumber: 'P450', floor: 100 })
  })

  it('accepts exact room-number length and safe-integer boundaries without increment overflow', () => {
    const input = { ...base, floorTo: 1, roomsPerFloor: 1, includeFloor: false, startSeq: Number.MAX_SAFE_INTEGER }
    const result = generateRoomNumbers(input)
    expect(result).toEqual({ rooms: [{ roomNumber: 'P9007199254740991', floor: 1 }], error: null })
    const exact = generateRoomNumbers({ ...input, prefix: 'AAAA' })
    expect(exact.rooms[0]!.roomNumber).toHaveLength(20)
    expect(quickRoomSchema.safeParse({ room_number: exact.rooms[0]!.roomNumber, floor: 1, monthly_rent: 0, area: null }).success).toBe(true)
    expect(generateRoomNumbers({ ...input, prefix: 'AAAAA' })).toEqual({ rooms: [], error: 'invalid_input' })
  })

  it('does not mutate its input or leak state across calls', () => {
    const input = Object.freeze({ ...base })
    const first = generateRoomNumbers(input)
    first.rooms.pop()
    expect(generateRoomNumbers(input).rooms).toHaveLength(6)
    expect(input).toEqual(base)
  })
})
