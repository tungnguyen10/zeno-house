import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import UiModal from '~/components/ui/UiModal.vue'

const iconStubs = {
  IconX: true,
}

async function waitForDom() {
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UiModal', () => {
  it('wires title aria and closes on Escape', async () => {
    const wrapper = mount(UiModal, {
      attachTo: document.body,
      props: { open: true, title: 'Modal thử nghiệm' },
      slots: { default: '<button type="button">Body action</button>' },
      global: { stubs: iconStubs },
    })
    await waitForDom()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId!)?.textContent).toContain('Modal thử nghiệm')

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('traps Tab inside and restores previous focus after close', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mount(UiModal, {
      attachTo: document.body,
      props: { open: false, title: 'Modal focus' },
      slots: {
        default: `
          <button type="button" data-test="first">First</button>
          <button type="button" data-test="last">Last</button>
        `,
      },
      global: { stubs: iconStubs },
    })

    await wrapper.setProps({ open: true })
    await waitForDom()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
    const first = buttons[0]!
    const last = buttons.at(-1)!

    last.focus()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    first.focus()
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)

    await wrapper.setProps({ open: false })
    await waitForDom()
    expect(document.activeElement).toBe(opener)
  })
})

describe('UiDrawer', () => {
  it('wires title aria and closes on Escape', async () => {
    const wrapper = mount(UiDrawer, {
      attachTo: document.body,
      props: { modelValue: true, title: 'Drawer thử nghiệm' },
      slots: { default: '<button type="button">Body action</button>' },
      global: { stubs: iconStubs },
    })
    await waitForDom()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    const titleId = dialog.getAttribute('aria-labelledby')
    expect(titleId).toBeTruthy()
    expect(document.getElementById(titleId!)?.textContent).toContain('Drawer thử nghiệm')

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('traps Tab inside and restores previous focus after close', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()

    const wrapper = mount(UiDrawer, {
      attachTo: document.body,
      props: { modelValue: false, title: 'Drawer focus' },
      slots: {
        default: `
          <button type="button" data-test="first">First</button>
          <button type="button" data-test="last">Last</button>
        `,
      },
      global: { stubs: iconStubs },
    })

    await wrapper.setProps({ modelValue: true })
    await waitForDom()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
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
    await waitForDom()
    expect(document.activeElement).toBe(opener)
  })
})
