import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import TenantLayout from '~/layouts/tenant.vue'

const initialize = vi.fn()
vi.stubGlobal('usePortalTheme', () => ({ resolvedTheme: ref('dark'), initialize }))

describe('tenant layout', () => {
  it('applies the resolved appearance only to the portal shell', () => {
    const wrapper = mount(TenantLayout, {
      slots: { default: '<p>Portal content</p>' },
      global: {
        stubs: {
          PortalSidebar: true,
          PortalHeader: true,
          PortalTabBar: true,
          PortalToastHost: true,
          PortalInstallPrompt: true,
        },
      },
    })

    expect(wrapper.get('.portal-shell').attributes('data-theme')).toBe('dark')
    expect(initialize).toHaveBeenCalledOnce()
  })
})
