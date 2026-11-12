import { QUICK_ROOM_MAX } from '~/utils/validators/buildings'

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

export type GeneratorError = 'floor_range' | 'rooms_per_floor' | 'seq_overflow' | 'too_many'

const fail = (error: GeneratorError) => ({ rooms: [] as GeneratedRoom[], error })

export function generateRoomNumbers(input: RoomGeneratorInput): { rooms: GeneratedRoom[]; error: GeneratorError | null } {
  const { floorFrom, floorTo, roomsPerFloor, prefix, startSeq, includeFloor, nameFloorStart } = input
  if (!Number.isInteger(floorFrom) || !Number.isInteger(floorTo) || floorFrom < 1 || floorTo > 100 || floorFrom > floorTo) {
    return fail('floor_range')
  }
  if (!Number.isInteger(roomsPerFloor) || roomsPerFloor < 1 || roomsPerFloor > 99) return fail('rooms_per_floor')
  if (includeFloor && startSeq + roomsPerFloor - 1 > 99) return fail('seq_overflow')
  const floors = floorTo - floorFrom + 1
  if (floors * roomsPerFloor > QUICK_ROOM_MAX) return fail('too_many')

  const rooms: GeneratedRoom[] = []
  let running = startSeq
  for (let f = 0; f < floors; f++) {
    const floor = floorFrom + f
    for (let i = 0; i < roomsPerFloor; i++) {
      const roomNumber = includeFloor
        ? `${prefix}${nameFloorStart + f}${String(startSeq + i).padStart(2, '0')}`
        : `${prefix}${String(running++).padStart(2, '0')}`
      rooms.push({ roomNumber, floor })
    }
  }
  return { rooms, error: null }
}
