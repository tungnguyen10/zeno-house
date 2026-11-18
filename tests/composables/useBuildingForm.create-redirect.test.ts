import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const apiFetch = vi.hoisted(() => vi.fn())
const navigateTo = vi.hoisted(() => vi.fn())
const canManage = vi.hoisted(() => ({ value: true }))
const toastSuccess = vi.hoisted(() => vi.fn())

vi.stubGlobal('apiFetch', apiFetch)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('clearNuxtData', vi.fn())
vi.stubGlobal('useAuthStore', () => ({ get canManage() { return canManage.value } }))
vi.stubGlobal('useToast', () => ({ success: toastSuccess, error: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  canManage.value = true
  apiFetch.mockResolvedValue({ data: { id: 'b-1', slug: 'toa-a' } })
})

async function submit() {
  const { useBuildingForm } = await import('~/composables/buildings/useBuildingForm')
  const formData = ref({ name: 'Tòa A', address: '12 Đường Số 1' })
  const { submitCreate } = useBuildingForm({ draftKey: { mode: 'create' }, formData, initialSnapshot: ref({ ...formData.value }) } as never)
  await submitCreate({ name: 'Tòa A', address: '12 Đường Số 1' } as never)
}

describe('useBuildingForm.submitCreate redirect', () => {
  it('goes to settings in setup mode for managers', async () => {
    await submit()
    expect(navigateTo).toHaveBeenCalledWith('/dashboard/buildings/toa-a/settings?setup=1')
    expect(toastSuccess).toHaveBeenCalledWith('Đã tạo tòa nhà. Tiếp tục thiết lập để sẵn sàng cho thuê.')
  })

  it('falls back to the building detail page without manage rights', async () => {
    canManage.value = false
    await submit()
    expect(navigateTo).toHaveBeenCalledWith('/dashboard/buildings/toa-a')
  })
})
