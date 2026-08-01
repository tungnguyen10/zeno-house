import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(
  process.cwd(),
  'app/pages/dashboard/buildings/[id]/settings.vue',
), 'utf8')

describe('building settings prepaid deletion', () => {
  it('requires confirmation and makes historical rows read-only', () => {
    expect(page).toContain('const prepaidDeleteTarget = ref<PrepaidExpense | null>(null)')
    expect(page).toContain('@click="openPrepaidDelete(item)"')
    expect(page).toContain('v-if="item.status === \'active\'"')
    expect(page).toContain('<UiConfirmModal')
    expect(page).toContain('confirm-label="Xóa và ngừng phân bổ"')
    expect(page).toContain('@confirm="confirmPrepaidDelete"')
    expect(page).toContain('Số liệu các kỳ đã chốt được giữ nguyên.')
    expect(page).not.toContain('@click="removePrepaid(item)"')
  })
})
