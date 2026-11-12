import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { InventoryItem } from '~/types/inventory'
import { mapInventoryItem, type InventoryRow } from '~/utils/mappers/inventory'
import type { InventoryApplyInput, InventoryItemInput } from '~/utils/validators/inventory'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../repositories/buildings'
import { RoomRepository } from '../repositories/rooms'
import { InventoryRepository } from '../repositories/inventory'
import { assertBuildingScope } from '../utils/scope'
import { AuditService } from './audit'

async function requireBuilding(event: H3Event, identifier: string) {
  const building = await BuildingRepository.findByIdentifier(event, identifier)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

async function requireRoom(event: H3Event, identifier: string) {
  const room = await RoomRepository.findByIdentifier(event, identifier)
  if (!room) throwNotFound('Không tìm thấy phòng')
  return room
}

function diff(before: InventoryRow[], after: InventoryItemInput[]) {
  const key = (name: string) => name.trim().toLocaleLowerCase('vi')
  const old = new Map(before.map(row => [key(row.name), row]))
  const next = new Map(after.map(item => [key(item.name), item]))
  let added = 0
  let removed = 0
  let changed = 0
  for (const [k, item] of next) {
    const prev = old.get(k)
    if (!prev) added++
    else if (
      prev.quantity !== item.quantity
      || prev.condition !== item.condition
      || (prev.unit_value === null ? null : Number(prev.unit_value)) !== item.unit_value
      || prev.note !== item.note
    ) changed++
  }
  for (const k of old.keys()) if (!next.has(k)) removed++
  return { added, removed, changed }
}

export const InventoryService = {
  async getTemplate(event: H3Event, user: AuthUser, buildingIdentifier: string): Promise<InventoryItem[]> {
    requireCapability(user, 'rooms.read', 'Không có quyền xem nội thất')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    return (await InventoryRepository.listTemplate(event, building.id)).map(mapInventoryItem)
  },

  async saveTemplate(event: H3Event, user: AuthUser, buildingIdentifier: string, items: InventoryItemInput[]): Promise<InventoryItem[]> {
    requireCapability(user, 'buildings.update', 'Không có quyền sửa nội thất mẫu')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const rows = await InventoryRepository.replaceTemplate(event, building.id, items)
    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.BUILDING_INVENTORY_TEMPLATE_UPDATED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { item_count: rows.length },
    })
    return rows.map(mapInventoryItem)
  },

  async applyTemplate(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    input: InventoryApplyInput,
  ): Promise<{ appliedRooms: number, addedItems: number }> {
    requireCapability(user, 'rooms.update', 'Không có quyền cập nhật phòng')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    // The RPC validates room membership under row locks and applies all rooms or none.
    const result = await InventoryRepository.applyTemplate(event, building.id, input.room_ids, input.mode)
    const addedItems = Object.values(result).reduce((sum, count) => sum + count, 0)
    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.ROOM_INVENTORY_TEMPLATE_APPLIED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { mode: input.mode, room_count: input.room_ids.length, added_items: addedItems },
    })
    return { appliedRooms: input.room_ids.length, addedItems }
  },

  async getRoom(event: H3Event, user: AuthUser, roomIdentifier: string): Promise<InventoryItem[]> {
    requireCapability(user, 'rooms.read', 'Không có quyền xem nội thất')
    const room = await requireRoom(event, roomIdentifier)
    await assertBuildingScope(event, user, room.buildingId, 'read')
    return (await InventoryRepository.listRoom(event, room.id)).map(mapInventoryItem)
  },

  async saveRoom(event: H3Event, user: AuthUser, roomIdentifier: string, items: InventoryItemInput[]): Promise<InventoryItem[]> {
    requireCapability(user, 'rooms.update', 'Không có quyền cập nhật phòng')
    const room = await requireRoom(event, roomIdentifier)
    await assertBuildingScope(event, user, room.buildingId, 'write')
    const before = await InventoryRepository.listRoom(event, room.id)
    const rows = await InventoryRepository.replaceRoom(event, room.id, items)
    await AuditService.append(event, user, {
      building_id: room.buildingId,
      action: AUDIT_ACTIONS.ROOM_INVENTORY_UPDATED,
      entity_type: 'room',
      entity_id: room.id,
      metadata: diff(before, items),
    })
    return rows.map(mapInventoryItem)
  },
}
