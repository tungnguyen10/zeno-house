import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const buildingDetail = read('app/pages/dashboard/buildings/[id]/index.vue')
const roomsList = read('app/pages/dashboard/rooms/index.vue')

describe('batch-rooms entry points', () => {
  it('building detail links to the batch page, gated on rooms.create', () => {
    expect(buildingDetail).toContain('/rooms/batch`')
    expect(buildingDetail).toContain(`authStore.can('rooms.create')`)
    expect(buildingDetail).toContain('Thêm phòng')
  })

  it('rooms list offers bulk-add for the filtered building', () => {
    expect(roomsList).toContain('/rooms/batch`')
    expect(roomsList).toContain('Thêm phòng hàng loạt')
    // Only shown when a building is selected in the filter.
    expect(roomsList).toContain(`authStore.can('rooms.create') && buildingId`)
  })
})
