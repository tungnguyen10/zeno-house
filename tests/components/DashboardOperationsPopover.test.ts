import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import DashboardOperationsPopover from '../../app/components/dashboard/DashboardOperationsPopover.vue'
import type { PendingOperation } from '../../app/types/dashboard'

const mountedWrappers: ReturnType<typeof mount>[] = []

const buttonStub = defineComponent({
  inheritAttrs: false,
  props: ['loading'],
  emits: ['click'],
  setup(_, { attrs, slots, emit }) {
    return () => h('button', { ...attrs, onClick: () => emit('click') }, slots.default?.())
  },
})

const linkStub = defineComponent({
  props: ['to'],
  setup(props, { slots }) {
    return () => h('a', { href: props.to }, slots.default?.())
  },
})

function buildItem(index: number): PendingOperation {
  return {
    type: index % 2 === 0 ? 'overdue_invoices' : 'missing_readings',
    building: { id: `b${index}`, slug: `toa-${index}`, name: `Tòa ${index}` },
    period: '2026-08',
    count: index + 1,
    severity: index % 2 === 0 ? 'danger' : 'warning',
    amount: index % 2 === 0 ? 1_000_000 * (index + 1) : undefined,
  }
}

function mountPopover(props: { items?: PendingOperation[], loading?: boolean, error?: string | null } = {}) {
  const wrapper = mount(DashboardOperationsPopover, {
    props: {
      items: props.items ?? [],
      loading: props.loading ?? false,
      error: props.error ?? null,
    },
    attachTo: document.body,
    global: {
      stubs: {
        UiButton: buttonStub,
        UiSkeleton: defineComponent({ template: '<div data-test="skeleton" />' }),
        NuxtLink: linkStub,
        IconBell: true,
        IconRefresh: true,
        IconChevronRight: true,
      },
    },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('DashboardOperationsPopover', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('shows a truthful indicator and at most five API-sorted operations', async () => {
    const wrapper = mountPopover({ items: Array.from({ length: 6 }, (_, index) => buildItem(index)) })
    const trigger = wrapper.get('[data-operations-trigger]')

    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-operations-indicator]').exists()).toBe(true)
    await trigger.trigger('click')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('[data-operation-item]')).toHaveLength(5)
    expect(wrapper.get('a[href="/dashboard#pending-operations"]').text()).toContain('Xem tất cả')
  })

  it('pins the panel inside the mobile viewport and restores desktop anchoring', async () => {
    const wrapper = mountPopover({ items: [buildItem(0)] })
    await wrapper.get('[data-operations-trigger]').trigger('click')
    const panel = wrapper.get('[data-operations-panel]')

    expect(panel.classes()).toContain('fixed')
    expect(panel.classes()).toContain('inset-x-4')
    expect(panel.classes()).toContain('w-auto')
    expect(panel.classes()).toContain('lg:absolute')
    expect(panel.classes()).toContain('lg:right-0')
    expect(panel.classes()).toContain('lg:w-[22rem]')
  })

  it('renders loading, empty and retryable error states without a fake indicator', async () => {
    const loading = mountPopover({ loading: true })
    await loading.get('[data-operations-trigger]').trigger('click')
    expect(loading.findAll('[data-test="skeleton"]')).toHaveLength(3)
    expect(loading.find('[data-operations-indicator]').exists()).toBe(false)

    const staleLoading = mountPopover({ items: [buildItem(0)], loading: true })
    expect(staleLoading.find('[data-operations-indicator]').exists()).toBe(false)

    const staleError = mountPopover({ items: [buildItem(0)], error: 'Không tải được dữ liệu' })
    expect(staleError.find('[data-operations-indicator]').exists()).toBe(false)

    const empty = mountPopover()
    await empty.get('[data-operations-trigger]').trigger('click')
    expect(empty.text()).toContain('Không có việc tồn')

    const errored = mountPopover({ error: 'Không tải được dữ liệu' })
    await errored.get('[data-operations-trigger]').trigger('click')
    await errored.get('[data-retry-operations]').trigger('click')
    expect(errored.emitted('refresh')).toHaveLength(1)
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const wrapper = mountPopover({ items: [buildItem(0)] })
    const trigger = wrapper.get<HTMLButtonElement>('[data-operations-trigger]')
    trigger.element.focus()
    await trigger.trigger('click')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
  })

  it('moves focus through operation links with arrow keys', async () => {
    const wrapper = mountPopover({ items: [buildItem(0), buildItem(1)] })
    await wrapper.get('[data-operations-trigger]').trigger('click', { detail: 1 })
    const items = wrapper.findAll<HTMLElement>('[data-operation-item]')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await nextTick()
    expect(document.activeElement).toBe(items[0]?.element)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await nextTick()
    expect(document.activeElement).toBe(items[1]?.element)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    await nextTick()
    expect(document.activeElement).toBe(items[0]?.element)
  })

  it('opens from keyboard with visible item focus and does not hijack arrows outside', async () => {
    const wrapper = mountPopover({ items: [buildItem(0), buildItem(1)] })
    const trigger = wrapper.get('[data-operations-trigger]')
    await trigger.trigger('keydown.enter')
    await nextTick()

    const firstItem = wrapper.get<HTMLElement>('[data-operation-item]')
    expect(document.activeElement).toBe(firstItem.element)
    expect(firstItem.classes()).toContain('focus-visible:ring-2')
    expect(wrapper.get('[data-operations-panel]').attributes('role')).toBe('dialog')

    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true })
    window.dispatchEvent(arrow)

    expect(arrow.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(outside)
  })
})
