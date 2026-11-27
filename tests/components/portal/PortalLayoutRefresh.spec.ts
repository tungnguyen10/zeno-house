import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import TenantLayout from '~/layouts/tenant.vue'

const status = ref('pending')
const route = reactive({ path: '/portal', query: {} as Record<string, string> })
vi.stubGlobal('usePortalTheme', () => ({ resolvedTheme: ref('light'), initialize: vi.fn() }))
vi.stubGlobal('usePortalBootstrap', () => ({ status, refresh: vi.fn() }))
vi.stubGlobal('usePortalConnection', () => ({ online: ref(true), reconnected: ref(false) }))
vi.stubGlobal('usePortalViewport', () => ({ height: ref(null), bottom: ref(0) }))
vi.stubGlobal('usePortalRefreshOnReturn', vi.fn())
vi.stubGlobal('usePortalSessionKey', () => ref('portal-tenant-a-shell'))
vi.stubGlobal('useRoute', () => route)
afterEach(() => vi.useRealTimers())

describe('tenant layout initial loading', () => {
  it('shows the splash once and keeps the content visible during later refreshes', async () => {
    vi.useFakeTimers()
    status.value = 'pending'
    const wrapper = mount(TenantLayout, { slots: { default: 'Current content' }, global: { stubs: { PortalSidebar: true, PortalHeader: true, PortalTabBar: true, PortalToastHost: true, PortalSplash: { template: '<div data-splash />' } } } })
    expect(wrapper.find('[data-splash]').exists()).toBe(true)
    status.value = 'success'
    await vi.advanceTimersByTimeAsync(300)
    expect(wrapper.find('[data-splash]').exists()).toBe(false)
    status.value = 'pending'
    await nextTick()
    expect(wrapper.find('[data-splash]').exists()).toBe(false)
    expect(wrapper.get('main').text()).toBe('Current content')
    wrapper.unmount()
  })

  it('starts a successfully changed page at the top and preserves position on refresh or unchanged navigation', async () => {
    status.value = 'success'
    route.path = '/portal'
    const wrapper = mount(TenantLayout, { global: { stubs: { PortalSidebar: true, PortalHeader: true, PortalTabBar: true, PortalToastHost: true, PortalSplash: true } } })
    const main = wrapper.get('main').element
    main.scrollTop = 480
    status.value = 'pending'
    route.query = { view: 'same-page' }
    await nextTick()
    expect(main.scrollTop).toBe(480)
    status.value = 'success'
    // A blocked navigation never commits a different route path.
    route.path = '/portal'
    await nextTick()
    expect(main.scrollTop).toBe(480)
    route.path = '/portal/invoices/invoice-1'
    await nextTick()
    expect(main.scrollTop).toBe(0)
    wrapper.unmount()
  })
})
