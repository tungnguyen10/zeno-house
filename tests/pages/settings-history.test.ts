import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('settings history page contract', () => {
  const page = readFileSync(join(process.cwd(), 'app/pages/dashboard/settings/history.vue'), 'utf8')
  const composable = readFileSync(join(process.cwd(), 'app/composables/useAuditHistory.ts'), 'utf8')

  it('uses the shared display catalog and exposes explicit loading/error/load-more states', () => {
    expect(page).toContain('AUDIT_ENTITY_FILTER_OPTIONS')
    expect(page).toContain('auditActionLabel')
    expect(page).toContain('auditEntityDisplay')
    expect(page).toContain('Không thể tải nhật ký hoạt động')
    expect(page).toContain('Tải thêm')
    expect(page).toContain(':disabled="isLoadingMore"')
  })

  it('accumulates cursor pages without duplicate event ids', () => {
    expect(composable).toContain('cursor: requestedCursor')
    expect(composable).toContain('existingIds')
    expect(composable).toContain('response.data.filter')
    expect(composable).toContain('nextCursor.value !== requestedCursor')
    expect(composable).toContain('nextCursor.value = response.meta?.nextCursor ?? null')
  })
})
