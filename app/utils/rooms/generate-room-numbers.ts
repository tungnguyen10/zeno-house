import { QUICK_ROOM_MAX, quickRoomSchema } from '~/utils/validators/buildings'

export interface RoomGeneratorInput {
  floorFrom: number
  floorTo: number
  roomsPerFloor: number
  prefix: string
  startSeq: number
  includeFloor: boolean
  nameFloorStart: number
}

export interface GeneratedRoom {
  roomNumber: string
  floor: number
}

export type GeneratorError = 'floor_range' | 'rooms_per_floor' | 'seq_overflow' | 'too_many' | 'invalid_input'

const fail = (error: GeneratorError) => ({ rooms: [] as GeneratedRoom[], error })

export function generateRoomNumbers(input: RoomGeneratorInput): { rooms: GeneratedRoom[], error: GeneratorError | null } {
  const { floorFrom, floorTo, roomsPerFloor, prefix, startSeq, includeFloor, nameFloorStart } = input
  if (!Number.isInteger(floorFrom) || !Number.isInteger(floorTo) || floorFrom < 1 || floorTo > 100 || floorFrom > floorTo) {
    return fail('floor_range')
  }
  if (!Number.isInteger(roomsPerFloor) || roomsPerFloor < 1 || roomsPerFloor > 99) return fail('rooms_per_floor')
  if (typeof prefix !== 'string' || prefix.length > 10 || typeof includeFloor !== 'boolean'
    || !Number.isSafeInteger(startSeq) || startSeq < 0 || !Number.isSafeInteger(nameFloorStart) || nameFloorStart < 0) {
    return fail('invalid_input')
  }
  const floors = floorTo - floorFrom + 1
  const total = floors * roomsPerFloor
  const lastSequence = startSeq + ((includeFloor ? roomsPerFloor : total) - 1)
  const lastNameFloor = nameFloorStart + (floors - 1)
  if (!Number.isSafeInteger(lastSequence) || (includeFloor && !Number.isSafeInteger(lastNameFloor))) return fail('invalid_input')
  if (includeFloor && lastSequence > 99) return fail('seq_overflow')
  if (total > QUICK_ROOM_MAX) return fail('too_many')

  const rooms: GeneratedRoom[] = []
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < roomsPerFloor; i++) {
      const sequence = startSeq + (includeFloor ? i : f * roomsPerFloor + i)
      const roomNumber = includeFloor
        ? `${prefix}${nameFloorStart + f}${String(sequence).padStart(2, '0')}`
        : `${prefix}${String(sequence).padStart(2, '0')}`
      if (!quickRoomSchema.shape.room_number.safeParse(roomNumber).success) return fail('invalid_input')
      rooms.push({ roomNumber, floor: floorFrom + f })
    }
  }
  return { rooms, error: null }
}
