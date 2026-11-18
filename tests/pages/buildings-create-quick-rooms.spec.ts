import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/create.vue'), 'utf8')

describe('building create quick rooms', () => {
  it('uses the floor-based RoomBatchGenerator', () => {
    expect(page).toContain('useQuickRoomPreview({ enabled: true, initialRoomsPerFloor: 0 })')
    expect(page).toContain('<RoomBatchGenerator')
    // The PR0 single-floor inputs are gone (moved into the generator component).
    expect(page).not.toContain('label="Số lượng phòng"')
    expect(page).not.toContain('previewColumns')
  })

  it('always shows the rooms block and sends rooms via toPayload', () => {
    expect(page).toContain('useQuickRoomPreview({ enabled: true, initialRoomsPerFloor: 0 })')
    expect(page).not.toContain('Bật tạo phòng nhanh')
    expect(page).toContain('preview.toPayload()')
    expect(page).toContain('Bên cho thuê, giá điện nước, thanh toán sẽ thiết lập ở bước tiếp theo.')
  })
})
