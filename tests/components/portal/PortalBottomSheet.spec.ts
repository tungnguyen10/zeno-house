import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PortalBottomSheet from '~/components/portal/PortalBottomSheet.vue'

const resolvedTheme = ref<'light' | 'dark'>('light')
vi.stubGlobal('usePortalTheme', () => ({ resolvedTheme }))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PortalBottomSheet', () => {
  it('carries the resolved portal theme into its teleported dialog', () => {
    const wrapper = mount(PortalBottomSheet, {
      props: {
        modelValue: true,
        title: 'Bỏ thay đổi?',
      },
      global: {
        stubs: {
          IconX: true,
          transition: false,
        },
      },
    })

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.dataset.theme).toBe('light')

    wrapper.unmount()
  })
})
