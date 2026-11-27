import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import SettingsIndex from '~/pages/dashboard/settings/index.vue'

const navigateTo = vi.fn()
const originalMatchMedia = window.matchMedia

function mountIndex(role: 'admin' | 'manager', desktop: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: desktop }) as unknown as typeof window.matchMedia
  vi.stubGlobal('useAuthStore', () => ({ isAdmin: role === 'admin', role }))
  return mount(SettingsIndex, {
    global: { stubs: { UiPageHeader: { template: '<header><slot /></header>' }, AppSettingsNav: true, UiSkeleton: true } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('settings index', () => {
  it('replaces itself with the first visible item on desktop', async () => {
    mountIndex('admin', true)
    await flushPromises()

    expect(navigateTo).toHaveBeenCalledWith('/dashboard/settings/profile', { replace: true })
  })

  it('stays as the drill-in list on mobile', async () => {
    const wrapper = mountIndex('manager', false)
    await flushPromises()

    expect(navigateTo).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'AppSettingsNav' }).exists()).toBe(true)
  })
})
