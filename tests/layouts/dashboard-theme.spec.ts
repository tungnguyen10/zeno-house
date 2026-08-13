import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import DefaultLayout from '../../app/layouts/default.vue'

describe('default layout dashboard theme lifecycle', () => {
  it('initializes the dashboard theme and disposes it on unmount', () => {
    const initialize = vi.fn()
    const dispose = vi.fn()
    vi.stubGlobal('useDashboardTheme', () => ({ initialize, dispose }))
    vi.stubGlobal('useAppStore', () => ({ closeSidebar: vi.fn(), toggleSidebar: vi.fn() }))
    vi.stubGlobal('storeToRefs', () => ({ sidebarOpen: ref(false) }))
    vi.stubGlobal('useDashboardSummary', () => ({
      summary: ref(null),
      isLoading: ref(false),
      error: ref(null),
      errorCode: ref(null),
      refresh: vi.fn(),
    }))

    const wrapper = mount(DefaultLayout, {
      global: {
        stubs: {
          AppSidebar: defineComponent({ template: '<aside />' }),
          AppHeader: defineComponent({ template: '<header><slot name="status" /></header>' }),
          DashboardOperationsPopover: true,
          AppAiDevChat: true,
          UiToastHost: true,
        },
      },
    })

    expect(initialize).toHaveBeenCalledOnce()

    wrapper.unmount()
    expect(dispose).toHaveBeenCalledOnce()
  })
})
