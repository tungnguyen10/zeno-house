export type InventoryCondition = 'good' | 'used' | 'damaged'

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  condition: InventoryCondition
  unitValue: number | null
  note: string | null
  sortOrder: number
}

export interface HandoverInventory {
  sourceContractId: string | null
  sourceContractCode: string | null
  items: InventoryItem[]
}

export const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> = {
  good: 'Tốt',
  used: 'Đã qua sử dụng',
  damaged: 'Hư hỏng',
}
