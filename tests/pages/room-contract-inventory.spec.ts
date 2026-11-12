import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('room and contract inventory surfaces', () => {
  it('room detail has an inventory section', () => {
    const page = read('app/pages/dashboard/rooms/[code]/index.vue')
    expect(page).toContain('<InventoryItemsEditor')
    expect(page).toContain('Áp dụng mẫu tòa')
  })

  it('contract form shows handover inventory and create page sends it', () => {
    expect(read('app/components/contracts/ContractForm.vue')).toContain('Nội thất bàn giao')
    expect(read('app/pages/dashboard/contracts/create.vue')).toContain('inventory: data.inventory')
  })

  it('contract detail and checkout show handover list', () => {
    expect(read('app/pages/dashboard/contracts/[code]/index.vue')).toContain('<ContractHandoverSection')
    expect(read('app/pages/dashboard/contracts/[code]/index.vue')).toContain(`'handover'`)
    expect(read('app/components/contracts/ContractCheckoutSection.vue')).toContain('Nội thất đã bàn giao')
  })
})
