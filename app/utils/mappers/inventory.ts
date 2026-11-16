import type { InventoryCondition, InventoryItem } from '~/types/inventory'

export interface InventoryRow {
  id: string
  name: string
  quantity: number
  condition: string
  unit_value: number | string | null
  note: string | null
  sort_order: number
}

export function mapInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    condition: row.condition as InventoryCondition,
    unitValue: row.unit_value === null ? null : Number(row.unit_value),
    note: row.note,
    sortOrder: row.sort_order,
  }
}

export function inventoryTotalValue(items: Pick<InventoryItem, 'quantity' | 'unitValue'>[]): number {
  return items.reduce((sum, item) => sum + (item.unitValue ?? 0) * item.quantity, 0)
}
