import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('building inventory pages', () => {
  it('create page uses the floor generator', () => {
    const page = read('app/pages/dashboard/buildings/create.vue')
    expect(page).toContain('<RoomBatchGenerator')
    expect(page).not.toContain('label="Số lượng phòng"')
  })

  it('batch page loads existing rooms and offers template inventory', () => {
    const page = read('app/pages/dashboard/buildings/[id]/rooms/batch.vue')
    expect(page).toContain('existingRoomNumbers')
    expect(page).toContain('Áp dụng nội thất mẫu')
    expect(page).toContain('useRoomBatchCreate(')
  })

  it('settings page has the inventory template section with apply modal', () => {
    const page = read('app/pages/dashboard/buildings/[id]/settings.vue')
    expect(page).toContain(`id: 'inventory-template'`)
    expect(page).toContain('<InventoryItemsEditor')
    expect(page).toContain('<InventoryApplyModal')
  })
})
