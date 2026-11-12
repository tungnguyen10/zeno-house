import { shallowMount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from '~/pages/dashboard/buildings/[id]/index.vue'

const readinessData = ref(null)
const readinessStatus = ref('idle')
const readinessError = ref<Error | null>(null)
const refreshReadiness = vi.fn()
const clearReadiness = vi.fn()
const fetchReadiness = vi.fn()
const auth = reactive({ canManage: true, allowed: true, can: (_capability: string) => auth.allowed })

function mountPage() {
  return shallowMount(Page, { global: { stubs: [
    'UiSkeleton', 'UiAlert', 'UiPageHeader', 'BuildingDetailHero', 'BuildingReadinessCard',
    'UiSurfacePanel', 'UiBadge', 'UiToggle', 'UiConfirmModal', 'IconDoor', 'IconDocumentText',
    'IconChart', 'IconSpinner', 'NuxtLink',
  ], renderStubDefaultSlot: true } })
}

beforeEach(() => {
  readinessData.value = null
  readinessStatus.value = 'idle'
  readinessError.value = null
  auth.canManage = true
  auth.allowed = true
  refreshReadiness.mockReset()
  clearReadiness.mockReset()
  fetchReadiness.mockReset().mockReturnValue({ data: readinessData, status: readinessStatus, error: readinessError, refresh: refreshReadiness, clear: clearReadiness })
  vi.stubGlobal('useFetch', fetchReadiness)
  vi.stubGlobal('useRoute', () => ({ params: { id: 'zeno' } }))
  vi.stubGlobal('useAuthStore', () => auth)
  vi.stubGlobal('useBuildingDetail', () => ({ building: ref({ id: 'b1', slug: 'zeno', name: 'Zeno', address: 'Huế', createdAt: '2026-01-01' }), isLoading: ref(false), error: ref(null), refresh: vi.fn() }))
  vi.stubGlobal('useBuildingServices', () => ({ services: ref([]), isLoading: ref(false), updateService: vi.fn(), refresh: vi.fn() }))
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
})

describe('building detail ancillary readiness', () => {
  it('renders building content while readiness is pending and keeps fetch nonblocking and client-only', () => {
    readinessStatus.value = 'pending'
    const wrapper = mountPage()
    expect(wrapper.findComponent({ name: 'BuildingDetailHero' }).exists()).toBe(true)
    expect(wrapper.get('[data-test="readiness-loading"]').text()).toContain('Đang kiểm tra')
    expect(fetchReadiness).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ lazy: true, server: false }))
    expect(fetchReadiness.mock.calls[0]![0]()).toBe('/api/buildings/zeno/readiness')
    wrapper.unmount()
  })

  it('shows a local error with retry and preserves the main detail surface', async () => {
    readinessStatus.value = 'error'
    readinessError.value = new Error('Network failed')
    const wrapper = mountPage()
    expect(wrapper.findComponent({ name: 'BuildingDetailHero' }).exists()).toBe(true)
    expect(wrapper.get('[data-test="readiness-error"]').text()).toContain('Không thể kiểm tra')
    refreshReadiness.mockClear()
    await wrapper.get('[data-test="readiness-retry"]').trigger('click')
    expect(refreshReadiness).toHaveBeenCalledOnce()
    readinessStatus.value = 'success'
    readinessError.value = null
    readinessData.value = { data: { contract: { ready: true, missing: [] }, billing: { ready: true, missing: [] } } } as never
    await nextTick()
    expect(wrapper.findComponent({ name: 'BuildingReadinessCard' }).exists()).toBe(true)
    expect(wrapper.find('[data-test="readiness-error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('hides the region without capability and starts loading when authorization arrives', async () => {
    auth.allowed = false
    const wrapper = mountPage()
    expect(fetchReadiness.mock.calls[0]![1].immediate).toBe(false)
    expect(wrapper.find('[data-test="building-readiness"]').exists()).toBe(false)
    expect(refreshReadiness).not.toHaveBeenCalled()
    auth.allowed = true
    await nextTick()
    expect(refreshReadiness).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-test="building-readiness"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
