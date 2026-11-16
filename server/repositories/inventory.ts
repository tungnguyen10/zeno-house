import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { InventoryRow } from '~/utils/mappers/inventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'
import type { Json } from '~/types/database.types'

// Cast at the boundary until database.types.ts is regenerated after the cloud migration.
const from = (event: H3Event, table: string) => db(event).from(table as never)
const COLUMNS = 'id, name, quantity, condition, unit_value, note, sort_order'

function toRows(items: InventoryItemInput[], key: 'building_id' | 'room_id' | 'contract_id', id: string) {
  return items.map((item, index) => ({ [key]: id, ...item, sort_order: index }))
}

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
    const { data, error } = await from(event, 'building_inventory_templates').select(COLUMNS).eq('building_id', buildingId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listTemplate')
    return (data ?? []) as InventoryRow[]
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
    const { data, error } = await from(event, 'room_inventory_items').select(COLUMNS).eq('room_id', roomId).order('sort_order')
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
    const { data, error } = await db(event).rpc('apply_inventory_template' as never, {
      p_building_id: buildingId, p_room_ids: roomIds, p_mode: mode,
    } as never)
    if (error) mapInventoryDbError(error, 'inventory.applyTemplate')
    return (data ?? {}) as Record<string, number>
  },

  async listContract(event: H3Event, contractId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'contract_inventory_items').select(COLUMNS).eq('contract_id', contractId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listContract')
    return (data ?? []) as InventoryRow[]
  },

  async replaceContract(event: H3Event, contractId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    const { error: delError } = await from(event, 'contract_inventory_items').delete().eq('contract_id', contractId)
    if (delError) mapInventoryDbError(delError, 'inventory.replaceContract.delete')
    if (items.length === 0) return []
    const { data, error } = await from(event, 'contract_inventory_items').insert(toRows(items, 'contract_id', contractId) as never).select(COLUMNS).order('sort_order')
    if (error) mapInventoryDbError(error, 'inventory.replaceContract.insert')
    return (data ?? []) as InventoryRow[]
  },
}
