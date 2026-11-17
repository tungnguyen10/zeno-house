import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal('apiFetch', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('clearNuxtData', vi.fn())
vi.stubGlobal('useAuthStore', () => ({ canManage: true }))
vi.stubGlobal('useToast', () => ({ success: vi.fn(), error: vi.fn() }))

beforeEach(() => window.localStorage.clear())

describe('useBuildingForm create draft', () => {
  it('drops the removed owner fields from a stale create draft', async () => {
    window.localStorage.setItem('building-form:create', JSON.stringify({
      name: 'Tòa A', address: '12 Đường Số 1', ownerName: 'Chủ Cũ', ownerPhone: '0901234567', ownerEmail: 'chu@example.com',
    }))
    const { useBuildingForm } = await import('~/composables/buildings/useBuildingForm')
    const formData = ref({ name: '', address: '' })
    const form = useBuildingForm({ draftKey: { mode: 'create' }, formData, initialSnapshot: ref({ name: '', address: '' }) })

    const stored = window.localStorage.getItem('building-form:create')!
    expect(stored).not.toContain('ownerName')
    expect(stored).not.toContain('chu@example.com')
    form.restoreDraft()
    expect(formData.value).toEqual({ name: 'Tòa A', address: '12 Đường Số 1' })
  })
})
