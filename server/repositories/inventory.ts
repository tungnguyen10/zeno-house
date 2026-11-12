import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { InventoryRow } from '~/utils/mappers/inventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'

// Cast at the boundary until database.types.ts is regenerated after the cloud migration.
const from = (event: H3Event, table: string) => db(event).from(table as never)
const rpc = (event: H3Event, fn: string, args: Record<string, unknown>) => db(event).rpc(fn as never, args as never)
const COLUMNS = 'id, name, quantity, condition, unit_value, note, sort_order'

const VALIDATION_MESSAGES: Record<string, string> = {
  INVENTORY_ITEMS_LIMIT: 'Danh sách nội thất vượt quá 50 món',
  INVENTORY_ITEMS_DUPLICATE: 'Tên món nội thất bị trùng',
  INVENTORY_ITEMS_INVALID: 'Danh sách nội thất không hợp lệ',
  INVENTORY_ROOMS_INVALID: 'Danh sách phòng không hợp lệ',
  INVENTORY_MODE_INVALID: 'Chế độ áp dụng không hợp lệ',
}

function mapInventoryDbError(error: unknown, context: string): never {
  const message = String((error as { message?: string } | null)?.message ?? '')
  if (message === 'INVENTORY_ROOM_SCOPE') throwForbidden('Có phòng không thuộc tòa nhà này')
  if (message === 'BUILDING_NOT_FOUND') throwNotFound('Không tìm thấy tòa nhà')
  const validationMessage = VALIDATION_MESSAGES[message]
  if (validationMessage) throwValidationError(validationMessage, { reason: message })
  throwDbError(error, context)
}

export const InventoryRepository = {
  async listTemplate(event: H3Event, buildingId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'building_inventory_templates').select(COLUMNS).eq('building_id', buildingId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listTemplate')
    return (data ?? []) as InventoryRow[]
  },

  async replaceTemplate(event: H3Event, buildingId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    const { data, error } = await rpc(event, 'replace_inventory_template', { p_building_id: buildingId, p_items: items })
    if (error) mapInventoryDbError(error, 'inventory.replaceTemplate')
    return sortRows(data)
  },

  async listRoom(event: H3Event, roomId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'room_inventory_items').select(COLUMNS).eq('room_id', roomId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listRoom')
    return (data ?? []) as InventoryRow[]
  },

  async replaceRoom(event: H3Event, roomId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    const { data, error } = await rpc(event, 'replace_room_inventory', { p_room_id: roomId, p_items: items })
    if (error) mapInventoryDbError(error, 'inventory.replaceRoom')
    return sortRows(data)
  },

  async applyTemplate(event: H3Event, buildingId: string, roomIds: string[], mode: 'merge' | 'replace'): Promise<Record<string, number>> {
    const { data, error } = await rpc(event, 'apply_inventory_template', {
      p_building_id: buildingId, p_room_ids: roomIds, p_mode: mode,
    })
    if (error) mapInventoryDbError(error, 'inventory.applyTemplate')
    return (data ?? {}) as Record<string, number>
  },

  async listContract(event: H3Event, contractId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'contract_inventory_items').select(COLUMNS).eq('contract_id', contractId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listContract')
    return (data ?? []) as InventoryRow[]
  },
}

// RPC `returning *` row order is not contractually guaranteed.
function sortRows(data: unknown): InventoryRow[] {
  return [...((data ?? []) as InventoryRow[])].sort((a, b) => a.sort_order - b.sort_order)
}
