import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'
import { ContractRepository, type ContractFilters } from '../../repositories/contracts'
import { ContractOccupantRepository } from '../../repositories/contract-occupants'
import { RoomRepository } from '../../repositories/rooms'

export const ContractService = {
  async list(
    event: H3Event,
    user: AuthUser,
    filters: ContractFilters,
  ): Promise<{ items: ContractWithDetails[]; total: number }> {
    if (!can(user, 'contracts.read')) throwForbidden('Không có quyền xem danh sách hợp đồng')
    return ContractRepository.findAll(event, filters)
  },

  async get(event: H3Event, user: AuthUser, id: string): Promise<ContractWithDetails> {
    if (!can(user, 'contracts.read')) throwForbidden('Không có quyền xem hợp đồng')
    const contract = await ContractRepository.findById(event, id)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    return contract
  },

  async create(event: H3Event, user: AuthUser, input: ContractCreateInput): Promise<ContractWithDetails> {
    if (!can(user, 'contracts.create')) throwForbidden('Không có quyền tạo hợp đồng')

    const room = await RoomRepository.findById(event, input.room_id)
    if (!room) throwNotFound('Không tìm thấy phòng')
    if (room.status === 'maintenance') throwConflict(`Phòng "${room.roomNumber}" đang bảo trì, không thể tạo hợp đồng`)

    if (input.status === 'active' || !input.status) {
      const roomConflict = await ContractRepository.findActiveByRoomId(event, input.room_id)
      if (roomConflict) throwConflict('Phòng này đã có hợp đồng đang hiệu lực')

      const primaryConflict = await ContractRepository.findActiveByTenantId(event, input.tenant_id)
      if (primaryConflict) throwConflict('Khách thuê này đang đứng tên hợp đồng tại phòng khác')

      const occupantConflict = await ContractOccupantRepository.findActiveOccupancyByTenant(event, input.tenant_id)
      if (occupantConflict) throwConflict('Khách thuê này đang ở theo hợp đồng khác')
    }

    const contract = await ContractRepository.insert(event, input)

    if (input.status === 'active' || !input.status) {
      await RoomRepository.update(event, input.room_id, { status: 'occupied' })
    }

    return contract
  },

  async update(event: H3Event, user: AuthUser, id: string, input: ContractUpdateInput): Promise<ContractWithDetails> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền cập nhật hợp đồng')
    const existing = await ContractRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy hợp đồng')
    if (input.status === 'active') {
      const roomId = input.room_id ?? existing.roomId
      const conflict = await ContractRepository.findActiveByRoomId(event, roomId, id)
      if (conflict) throwConflict('Phòng này đã có hợp đồng đang hiệu lực')
    }
    const updated = await ContractRepository.update(event, id, input)

    if (input.status === 'terminated' || input.status === 'expired') {
      const room = await RoomRepository.findById(event, existing.roomId)
      if (room && room.status !== 'maintenance') {
        await RoomRepository.update(event, existing.roomId, { status: 'available' })
      }
    }

    return updated
  },

  async remove(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'contracts.delete')) throwForbidden('Không có quyền xoá hợp đồng')
    const existing = await ContractRepository.findById(event, id)
    if (!existing) throwNotFound('Không tìm thấy hợp đồng')
    return ContractRepository.remove(event, id)
  },
}
