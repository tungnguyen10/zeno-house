import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import DashboardPendingList from '../../app/components/dashboard/DashboardPendingList.vue'
import type { PendingOperation } from '../../app/types/dashboard'

const emptyStub = defineComponent({
  props: ['title', 'description'],
  template: '<div data-test="empty"><slot /></div>',
})

function buildItem(overrides: Partial<PendingOperation> = {}): PendingOperation {
  return {
    type: 'overdue_invoices',
    building: { id: 'b1', slug: 'toa-a', name: 'Toa A' },
    period: '2026-06',
    count: 3,
    severity: 'danger',
    amount: 12_000_000,
    ...overrides,
  }
}

function mountList(items: PendingOperation[]) {
  return mount(DashboardPendingList, {
    props: { items },
    global: {
      stubs: {
        UiEmptyState: emptyStub,
        NuxtLink: defineComponent({
          props: ['to'],
          setup(_, { slots }) { return () => h('a', {}, slots.default?.()) },
        }),
      },
    },
  })
}

describe('DashboardPendingList', () => {
  it('renders empty state when items is empty', () => {
    const wrapper = mountList([])
    expect(wrapper.find('[data-test="empty"]').exists()).toBe(true)
  })

  it('renders rows for each item with formatted amount', () => {
    const wrapper = mountList([buildItem({ amount: 12_000_000 })])
    const text = wrapper.text()
    expect(text).toContain('Quá hạn')
    expect(text).toContain('Toa A')
    expect(text).toContain('2026-06')
    // 12.000.000 ₫ (vi-VN formatting)
    expect(text).toMatch(/12[.\u00a0]000[.\u00a0]000/)
  })

  it('renders em-dash when amount is undefined', () => {
    const wrapper = mountList([
      buildItem({ type: 'missing_readings', severity: 'warning', amount: undefined }),
    ])
    expect(wrapper.text()).toContain('—')
  })

  it('uses severity-colored dot for danger', () => {
    const wrapper = mountList([buildItem({ severity: 'danger' })])
    const html = wrapper.html()
    expect(html).toContain('bg-error-vivid')
  })

  it('uses severity-colored dot for warning', () => {
    const wrapper = mountList([buildItem({ severity: 'warning', amount: undefined })])
    expect(wrapper.html()).toContain('bg-warning')
  })

  it('uses severity-colored dot for info', () => {
    const wrapper = mountList([buildItem({ severity: 'info', amount: undefined })])
    expect(wrapper.html()).toContain('bg-cyan')
  })
})
