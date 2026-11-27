import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { usePortalRefreshOnReturn } from '~/composables/tenant-portal/usePortalRefreshOnReturn'

const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
afterEach(() => {
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility)
  else Reflect.deleteProperty(document, 'visibilityState')
})

function visibility(value: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('refresh after returning from a bank application', () => {
  it('refreshes the server on a real return and removes listeners when unmounted', async () => {
    const refresh = vi.fn(async () => {})
    const wrapper = mount(defineComponent({ setup() { usePortalRefreshOnReturn(refresh, ref('tenant-a')); return () => null } }))
    visibility('visible')
    expect(refresh).not.toHaveBeenCalled()
    visibility('hidden')
    visibility('visible')
    await flushPromises()
    expect(refresh).toHaveBeenCalledOnce()
    wrapper.unmount()
    window.dispatchEvent(new Event('online'))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('does not refresh a previous account on return after the identity changed', async () => {
    const refresh = vi.fn(async () => {})
    const key = ref('tenant-a')
    const wrapper = mount(defineComponent({ setup() { usePortalRefreshOnReturn(refresh, key); return () => null } }))
    visibility('hidden')
    key.value = 'tenant-b'
    visibility('visible')
    await flushPromises()
    expect(refresh).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
