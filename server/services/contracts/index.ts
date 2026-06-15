import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ContractWithDetails } from '~/types/contracts'
import type { ContractCreateInput, ContractUpdateInput } from '~/utils/validators/contracts'
import { ContractRepository, type ContractFilters } from '../../repositories/contracts'
import { ContractServiceService } from '../contract-services'
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
    const contract = await ContractRepository.findByIdentifier(event, id)
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

    // Room là nguồn giá chuẩn — nếu input không gửi giá hợp lệ, lấy từ phòng.
    // Nếu cả 2 đều bằng 0, từ chối ngay tại tầng service để không tạo hợp đồng "miễn phí" do bug form.
    const resolvedRent = input.monthly_rent && input.monthly_rent > 0
      ? input.monthly_rent
      : room.monthlyRent
    if (!resolvedRent || resolvedRent <= 0) {
      throwConflict(`Phòng "${room.roomNumber}" chưa được đặt giá thuê. Vui lòng cập nhật giá phòng trước khi tạo hợp đồng.`)
    }

    const contract = await ContractRepository.insert(event, {
      ...input,
      monthly_rent: resolvedRent,
      building_id: input.building_id ?? room.buildingId,
    })

    // Best-effort: clone active building_services → contract_services
    const buildingId = input.building_id ?? room.buildingId
    if (buildingId) {
      await ContractServiceService.cloneFromBuilding(event, contract.id, buildingId)
    }

    if (input.status === 'active' || !input.status) {
      await RoomRepository.update(event, input.room_id, { status: 'occupied' })
    }

    return contract
  },

  async update(event: H3Event, user: AuthUser, id: string, input: ContractUpdateInput): Promise<ContractWithDetails> {
    if (!can(user, 'contracts.update')) throwForbidden('Không có quyền cập nhật hợp đồng')
    const existing = await ContractRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy hợp đồng')

    const newStatus = input.status ?? existing.status
    const newRoomId = input.room_id ?? existing.roomId
    const wasActive = existing.status === 'active'
    const willBeActive = newStatus === 'active'
    const roomChanged = newRoomId !== existing.roomId

    if (willBeActive) {
      const conflict = await ContractRepository.findActiveByRoomId(event, newRoomId, existing.id)
      if (conflict) throwConflict('Phòng này đã có hợp đồng đang hiệu lực')
    }

    const updated = await ContractRepository.update(event, existing.id, input)

    // Release the previous room whenever the contract leaves it while having been active there:
    //   - active → expired/terminated (status transition)
    //   - active → active but moved to a different room
    if (wasActive && (!willBeActive || roomChanged)) {
      const oldRoom = await RoomRepository.findById(event, existing.roomId)
      if (oldRoom && oldRoom.status !== 'maintenance') {
        await RoomRepository.update(event, existing.roomId, { status: 'available' })
      }
    }

    // Claim the (new) room whenever the contract becomes active for it:
    //   - expired/terminated → active (reactivation)
    //   - active → active but reassigned to a different room
    if (willBeActive && (!wasActive || roomChanged)) {
      const newRoom = await RoomRepository.findById(event, newRoomId)
      if (newRoom && newRoom.status !== 'maintenance') {
        await RoomRepository.update(event, newRoomId, { status: 'occupied' })
      }
    }

    return updated
  },

  async remove(event: H3Event, user: AuthUser, id: string): Promise<void> {
    if (!can(user, 'contracts.delete')) throwForbidden('Không có quyền xoá hợp đồng')
    const existing = await ContractRepository.findByIdentifier(event, id)
    if (!existing) throwNotFound('Không tìm thấy hợp đồng')

    await ContractRepository.remove(event, existing.id)

    // If the deleted contract was active, release the room (unless under maintenance).
    // Deleting expired/terminated/renewed contracts must not change room status.
    if (existing.status === 'active') {
      const room = await RoomRepository.findById(event, existing.roomId)
      if (room && room.status !== 'maintenance') {
        await RoomRepository.update(event, existing.roomId, { status: 'available' })
      }
    }
  },
}
