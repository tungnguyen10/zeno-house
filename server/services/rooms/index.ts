import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Room } from '~/types/rooms'
import type { RoomCreateInput, RoomUpdateInput } from '~/utils/validators/rooms'
import { RoomRepository, type RoomFilters } from '../../repositories/rooms'
import { BuildingRepository } from '../../repositories/buildings'

export const RoomService = {
  async list(
    event: H3Event,
    user: AuthUser,
    filters: RoomFilters,
  ): Promise<{ items: Room[]; total: number }> {
    if (!can(user, 'rooms.read')) throwForbidden('Không có quyền xem danh sách phòng')
    return RoomRepository.findAll(event, filters)
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<Room> {
    if (!can(user, 'rooms.read')) throwForbidden('Không có quyền xem phòng')
    const room = await RoomRepository.findById(event, id)
    if (!room) throwNotFound('Không tìm thấy phòng')
    return room
  },

  async getByBuildingAndRoomSlug(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    roomSlug: string,
  ): Promise<Room> {
    if (!can(user, 'rooms.read')) throwForbidden('Không có quyền xem phòng')
    const building = await BuildingRepository.findByIdentifier(event, buildingIdentifier)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    const room = await RoomRepository.findByBuildingAndRoomSlug(event, building.id, roomSlug)
    if (!room) throwNotFound('Không tìm thấy phòng')
    return room
  },

  async create(event: H3Event, user: AuthUser, input: RoomCreateInput): Promise<Room> {
    if (!can(user, 'rooms.create')) throwForbidden('Không có quyền tạo phòng')
    return RoomRepository.insert(event, input)
  },

  async update(event: H3Event, user: AuthUser, id: string, input: RoomUpdateInput): Promise<Room> {
    if (!can(user, 'rooms.update')) throwForbidden('Không có quyền cập nhật phòng')
    const existing = await RoomRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy phòng')
    return RoomRepository.update(event, id, input)
  },

  async remove(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'rooms.delete')) throwForbidden('Không có quyền xoá phòng')
    const existing = await RoomRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy phòng')
    return RoomRepository.remove(event, id)
  },
}
