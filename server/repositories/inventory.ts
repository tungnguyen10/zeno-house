import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { InventoryRow } from '~/utils/mappers/inventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'
import type { Json } from '~/types/database.types'

const COLUMNS = 'id, name, quantity, condition, unit_value, note, sort_order'

function mapInventoryDbError(error: unknown, context: string): never {
  const message = String((error as { message?: string }).message ?? '')
  if (message === 'INVENTORY_ROOM_SCOPE') throwForbidden('Có phòng không thuộc tòa nhà này')
  if (message === 'CONTRACT_INVENTORY_LOCKED') {
    throwConflict('Hợp đồng đã phát hành, không sửa được danh sách bàn giao. Lập phụ lục nếu cần thay đổi.', { reason: 'CONTRACT_INVENTORY_LOCKED' })
  }
  if ((error as { code?: string }).code === '23505') throwConflict('Tên món nội thất bị trùng')
  throwDbError(error, context)
}

export const InventoryRepository = {
  async listTemplate(event: H3Event, buildingId: string): Promise<InventoryRow[]> {
    const { data, error } = await db(event).from('building_inventory_templates').select(COLUMNS).eq('building_id', buildingId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listTemplate')
    return (data ?? []) as InventoryRow[]
  },

  async roomOccupancyForSetup(event: H3Event, buildingId: string): Promise<{ roomIdsWithoutInventory: string[], vacantRoomIds: string[] }> {
    // One row per room (embedded count) so item volume cannot hit the PostgREST row cap.
    const { data, error } = await db(event)
      .from('rooms')
      .select('id, status, room_inventory_items(count)')
      .eq('building_id', buildingId)
      .neq('status', 'archived')
    if (error) throwDbError(error, 'inventory.roomOccupancyForSetup')
    const rooms = (data ?? []) as unknown as { id: string, status: string, room_inventory_items: { count: number }[] }[]
    return {
      roomIdsWithoutInventory: rooms.filter(r => (r.room_inventory_items[0]?.count ?? 0) === 0).map(r => r.id),
      vacantRoomIds: rooms.filter(r => r.status === 'available').map(r => r.id),
    }
  },

  async replaceTemplate(event: H3Event, buildingId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    // Validate, delete and insert in one database transaction; never expose a partial replacement.
    const { data, error } = await db(event).rpc('replace_inventory_template', {
      p_building_id: buildingId,
      p_items: items as unknown as Json,
    })
    if (error) mapInventoryDbError(error, 'inventory.replaceTemplate')
    return ((data ?? []) as InventoryRow[]).sort((a, b) => a.sort_order - b.sort_order)
  },

  async listRoom(event: H3Event, roomId: string): Promise<InventoryRow[]> {
    const { data, error } = await db(event).from('room_inventory_items').select(COLUMNS).eq('room_id', roomId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listRoom')
    return (data ?? []) as InventoryRow[]
  },

  async replaceRoom(event: H3Event, roomId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    // The existing RPC locks the room and rolls back the entire replacement on error.
    const { data, error } = await db(event).rpc('replace_room_inventory', {
      p_room_id: roomId,
      p_items: items as unknown as Json,
    })
    if (error) mapInventoryDbError(error, 'inventory.replaceRoom')
    return ((data ?? []) as InventoryRow[]).sort((a, b) => a.sort_order - b.sort_order)
  },

  async applyTemplate(event: H3Event, buildingId: string, roomIds: string[], mode: 'merge' | 'replace'): Promise<Record<string, number>> {
    const { data, error } = await db(event).rpc('apply_inventory_template', {
      p_building_id: buildingId, p_room_ids: roomIds, p_mode: mode,
    })
    if (error) mapInventoryDbError(error, 'inventory.applyTemplate')
    return (data ?? {}) as Record<string, number>
  },

  async listContract(event: H3Event, contractId: string): Promise<InventoryRow[]> {
    const { data, error } = await db(event).from('contract_inventory_items').select(COLUMNS).eq('contract_id', contractId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listContract')
    return (data ?? []) as InventoryRow[]
  },

  async replaceContract(event: H3Event, contractId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    const { data, error } = await db(event).rpc('replace_contract_inventory', {
      p_contract_id: contractId,
      p_items: items as unknown as Json,
    })
    if (error) mapInventoryDbError(error, 'inventory.replaceContract')
    return ((data ?? []) as InventoryRow[]).sort((a, b) => a.sort_order - b.sort_order)
  },
}
