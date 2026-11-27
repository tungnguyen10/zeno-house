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

  it('blocks background interaction and restores the original overflow on unmount', async () => {
    const root = document.createElement('div')
    root.id = '__nuxt'
    root.inert = false
    document.body.appendChild(root)
    document.body.style.overflow = 'clip'
    const wrapper = mount(PortalBottomSheet, { props: { modelValue: true, title: 'Chi tiết' }, global: { stubs: { IconX: true } } })
    await nextTick()
    expect(root.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.unmount()
    expect(root.inert).toBe(false)
    expect(document.body.style.overflow).toBe('clip')
    document.body.style.overflow = ''
  })

  it('keeps the dialog above a mobile keyboard within the visible viewport', async () => {
    const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const viewport = Object.assign(new EventTarget(), { height: 420, offsetTop: 0, scale: 1 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    const wrapper = mount(PortalBottomSheet, { props: { modelValue: true }, global: { stubs: { IconX: true } } })
    await nextTick()
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.style.maxHeight).toBe('408px')
    expect(dialog.style.bottom).toBe(`${Math.max(0, window.innerHeight - 420)}px`)
    viewport.height = 680
    viewport.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(dialog.style.maxHeight).toBe('668px')
    wrapper.unmount()
    if (previous) Object.defineProperty(window, 'visualViewport', previous)
    else Reflect.deleteProperty(window, 'visualViewport')
  })
})
