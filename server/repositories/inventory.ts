import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { InventoryRow } from '~/utils/mappers/inventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'

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
    const { error: delError } = await from(event, 'building_inventory_templates').delete().eq('building_id', buildingId)
    if (delError) throwDbError(delError, 'inventory.replaceTemplate.delete')
    if (items.length === 0) return []
    const { data, error } = await from(event, 'building_inventory_templates').insert(toRows(items, 'building_id', buildingId) as never).select(COLUMNS).order('sort_order')
    if (error) mapInventoryDbError(error, 'inventory.replaceTemplate.insert')
    return (data ?? []) as InventoryRow[]
  },

  async listRoom(event: H3Event, roomId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'room_inventory_items').select(COLUMNS).eq('room_id', roomId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listRoom')
    return (data ?? []) as InventoryRow[]
  },

  async replaceRoom(event: H3Event, roomId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    const { error: delError } = await from(event, 'room_inventory_items').delete().eq('room_id', roomId)
    if (delError) throwDbError(delError, 'inventory.replaceRoom.delete')
    if (items.length === 0) return []
    const { data, error } = await from(event, 'room_inventory_items').insert(toRows(items, 'room_id', roomId) as never).select(COLUMNS).order('sort_order')
    if (error) mapInventoryDbError(error, 'inventory.replaceRoom.insert')
    return (data ?? []) as InventoryRow[]
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
