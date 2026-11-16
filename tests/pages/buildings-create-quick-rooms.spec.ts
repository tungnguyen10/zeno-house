import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/create.vue'), 'utf8')

describe('building create quick rooms', () => {
  it('uses the floor-based RoomBatchGenerator', () => {
    expect(page).toContain('useQuickRoomPreview()')
    expect(page).toContain('<RoomBatchGenerator')
    // The PR0 single-floor inputs are gone (moved into the generator component).
    expect(page).not.toContain('label="Số lượng phòng"')
    expect(page).not.toContain('previewColumns')
  })

  it('keeps the enable toggle and sends rooms via toPayload', () => {
    expect(page).toContain('Bật tạo phòng nhanh')
    expect(page).toContain('preview.toPayload()')
    expect(page).not.toContain('quickRooms:')
  })
})
