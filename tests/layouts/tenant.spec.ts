import { mount } from '@vue/test-utils'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import TenantLayout from '~/layouts/tenant.vue'

const initialize = vi.fn()
const bootstrapStatus = ref<'pending' | 'success'>('success')
vi.stubGlobal('usePortalTheme', () => ({ resolvedTheme: ref('dark'), initialize }))
vi.stubGlobal('usePortalBootstrap', () => ({ status: bootstrapStatus }))

function mountTenantLayout() {
  return mount(TenantLayout, {
    slots: { default: '<p>Portal content</p>' },
    global: {
      stubs: {
        PortalSidebar: true,
        PortalHeader: true,
        PortalTabBar: true,
        PortalToastHost: true,
        PortalSplash: { template: '<div data-test="portal-splash" />' },
        Transition: false,
      },
    },
  })
}

afterEach(() => {
  bootstrapStatus.value = 'success'
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('tenant layout', () => {
  it('applies the resolved appearance only to the portal shell', () => {
    const wrapper = mountTenantLayout()

    expect(wrapper.get('.portal-shell').attributes('data-theme')).toBe('dark')
    expect(initialize).toHaveBeenCalledOnce()
  })

  it('keeps the portal splash mounted while shared bootstrap is pending', async () => {
    vi.useFakeTimers()
    bootstrapStatus.value = 'pending'
    const wrapper = mountTenantLayout()

    await vi.advanceTimersByTimeAsync(300)

    expect(wrapper.find('[data-test="portal-splash"]').exists()).toBe(true)
  })

  it('keeps a successful bootstrap splash visible for the full 300 ms brand interval before dismissing it', async () => {
    vi.useFakeTimers()
    const wrapper = mountTenantLayout()

    await vi.advanceTimersByTimeAsync(299)
    expect(wrapper.find('[data-test="portal-splash"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(1)
    await nextTick()
    expect(wrapper.find('[data-test="portal-splash"]').exists()).toBe(false)
  })

  it('uses PortalSplash only as the tenant layout\'s conditional portal mount', () => {
    const layoutsDirectory = resolve('app/layouts')
    const tenantLayout = readFileSync(resolve(layoutsDirectory, 'tenant.vue'), 'utf8')

    expect(tenantLayout).toContain('<PortalSplash v-if="showSplash" />')
    expect(tenantLayout).toContain("status.value === 'pending' || !minDelayElapsed.value")

    for (const layoutFile of readdirSync(layoutsDirectory)) {
      if (!layoutFile.endsWith('.vue') || layoutFile === 'tenant.vue') continue

      const layout = readFileSync(resolve(layoutsDirectory, layoutFile), 'utf8')
      expect(layout, `${layoutFile} must not mount the tenant portal splash`).not.toContain('<PortalSplash')
    }
  })

  it('mounts the single PWA install host at app scope instead of inside a role layout', () => {
    const app = readFileSync(resolve('app/app.vue'), 'utf8')
    const layoutsDirectory = resolve('app/layouts')

    expect(app).toContain('<PortalInstallPrompt />')

    for (const layoutFile of readdirSync(layoutsDirectory)) {
      if (!layoutFile.endsWith('.vue')) continue

      const layout = readFileSync(resolve(layoutsDirectory, layoutFile), 'utf8')
      expect(layout, `${layoutFile} must not own the app-wide install host`).not.toContain('<PortalInstallPrompt')
    }
  })
})
