import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PortalToastHost from '~/components/portal/PortalToastHost.vue'

const dismiss = vi.fn()
vi.stubGlobal('usePortalTheme', () => ({ resolvedTheme: ref('light') }))
vi.stubGlobal('usePortalToast', () => ({ toasts: ref([{ id: 1, severity: 'error', message: 'Chưa lưu được. Vui lòng thử lại.' }]), dismiss }))

describe('portal toast interaction', () => {
  it('keeps feedback below the header without intercepting sheet action taps and still lets the tenant dismiss it', async () => {
    const wrapper = mount(PortalToastHost, { global: { stubs: { Teleport: true, IconAlertCircle: true, IconX: true } } })
    const host = wrapper.get('[aria-label="Thông báo"]')
    const toast = wrapper.get('[role="status"]')
    expect(host.attributes('data-theme')).toBe('light')
    expect(host.classes()).toContain('portal-install-host')
    expect(host.classes()).toContain('top-[calc(4rem+env(safe-area-inset-top)+0.5rem)]')
    expect(toast.classes()).toContain('pointer-events-none')
    expect(toast.text()).toContain('Chưa lưu được')
    const close = wrapper.get('button[aria-label="Đóng thông báo"]')
    expect(close.classes()).toContain('pointer-events-auto')
    await close.trigger('click')
    expect(dismiss).toHaveBeenCalledWith(1)
    wrapper.unmount()
  })
})
