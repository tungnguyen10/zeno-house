import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
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

  it('names the dialog, traps focus, and restores the opener after close', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open install guide'
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mount(PortalBottomSheet, {
      attachTo: document.body,
      props: {
        modelValue: false,
        title: 'Thêm vào màn hình chính',
      },
      slots: {
        default: '<button type="button" data-test="guide-action" data-autofocus>Đã hiểu</button>',
      },
      global: {
        stubs: {
          IconX: true,
          transition: false,
        },
      },
    })

    await wrapper.setProps({ modelValue: true })
    await nextTick()
    await nextTick()

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId!)?.textContent).toContain('Thêm vào màn hình chính')
    expect(document.activeElement?.getAttribute('data-test')).toBe('guide-action')

    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
    const first = buttons[0]!
    const last = buttons.at(-1)!

    last.focus()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    first.focus()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)

    await wrapper.setProps({ modelValue: false })
    await nextTick()
    expect(document.activeElement).toBe(opener)

    wrapper.unmount()
  })

  it('accepts a dark appearance override for app-wide overlays outside the portal', () => {
    const wrapper = mount(PortalBottomSheet, {
      props: {
        modelValue: true,
        title: 'Cài đặt Zeno',
        theme: 'dark',
      },
      global: {
        stubs: {
          IconX: true,
          transition: false,
        },
      },
    })

    expect(document.body.querySelector<HTMLElement>('[role="dialog"]')?.dataset.theme).toBe('dark')

    wrapper.unmount()
  })
})
