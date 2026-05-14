import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { RoomAssignment, RoomAssignmentWithTenant, RoomAssignmentWithRoom } from '~/types/room-assignments'
import type { AssignInput } from '~/utils/validators/room-assignments'
import { RoomAssignmentRepository } from '../../repositories/room-assignments'
import { RoomRepository } from '../../repositories/rooms'

export const RoomAssignmentService = {
  async assign(event: H3Event, user: AuthUser, input: AssignInput): Promise<RoomAssignment> {
    if (!can(user, 'room-assignments.create')) throwForbidden('Không có quyền giao phòng')

    const room = await RoomRepository.findById(event, input.room_id)
    if (!room) throwNotFound('Không tìm thấy phòng')

    if (room.status === 'maintenance') {
      throwConflict(`Phòng "${room.roomNumber}" đang bảo trì, không thể giao phòng`)
    }

    // Check via actual assignment record (room.status may be stale from manual edit)
    const existingRoomAssignment = await RoomAssignmentRepository.findActiveByRoom(event, input.room_id)
    if (existingRoomAssignment) {
      throwConflict(`Phòng "${room.roomNumber}" đã có khách thuê (${existingRoomAssignment.tenant.fullName})`)
    }

    const existingTenantAssignment = await RoomAssignmentRepository.findActiveByTenant(event, input.tenant_id)
    if (existingTenantAssignment) {
      throwConflict(`Khách thuê đang ở phòng khác (phòng ${existingTenantAssignment.room.roomNumber})`)
    }

    const assignment = await RoomAssignmentRepository.insert(event, input)

    await RoomRepository.update(event, input.room_id, { status: 'occupied' })

    return assignment
  },

  async unassign(event: H3Event, user: AuthUser, id: string): Promise<RoomAssignment> {
    if (!can(user, 'room-assignments.delete')) throwForbidden('Không có quyền thu phòng')

    const assignment = await RoomAssignmentRepository.findById(event, id)
    if (!assignment) throwNotFound('Không tìm thấy thông tin giao phòng')

    if (assignment.endDate !== null) {
      throwConflict('Hợp đồng giao phòng này đã kết thúc')
    }

    const today = new Date().toISOString().slice(0, 10)
    const ended = await RoomAssignmentRepository.end(event, id, today)

    await RoomRepository.update(event, assignment.roomId, { status: 'available' })

    return ended
  },

  async getByRoom(event: H3Event, user: AuthUser, roomId: string): Promise<RoomAssignmentWithTenant | null> {
    if (!can(user, 'room-assignments.read')) throwForbidden('Không có quyền xem thông tin giao phòng')
    return RoomAssignmentRepository.findActiveByRoom(event, roomId)
  },

  async getByTenant(event: H3Event, user: AuthUser, tenantId: string): Promise<RoomAssignmentWithRoom | null> {
    if (!can(user, 'room-assignments.read')) throwForbidden('Không có quyền xem thông tin giao phòng')
    return RoomAssignmentRepository.findActiveByTenant(event, tenantId)
  },
}
