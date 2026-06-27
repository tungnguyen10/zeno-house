import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import DashboardOccupancyList from '../../app/components/dashboard/DashboardOccupancyList.vue'
import type { BuildingBreakdownEntry } from '../../app/types/dashboard'

const emptyStub = defineComponent({
  props: ['title', 'description'],
  template: '<div data-test="empty"><slot /></div>',
})

function buildBuilding(overrides: Partial<BuildingBreakdownEntry> = {}): BuildingBreakdownEntry {
  return {
    id: 'b1',
    slug: 'toa-a',
    name: 'Toa A',
    rooms: { total: 10, available: 4, occupied: 5, maintenance: 1 },
    ...overrides,
  }
}

function mountList(buildings: BuildingBreakdownEntry[]) {
  return mount(DashboardOccupancyList, {
    props: { buildings },
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

describe('DashboardOccupancyList', () => {
  it('renders empty state when no buildings', () => {
    const wrapper = mountList([])
    expect(wrapper.find('[data-test="empty"]').exists()).toBe(true)
  })

  it('renders occupancy percent computed per-row', () => {
    const wrapper = mountList([
      buildBuilding({ name: 'Toa Full', rooms: { total: 10, available: 0, occupied: 10, maintenance: 0 } }),
      buildBuilding({ id: 'b2', slug: 'toa-b', name: 'Toa Half', rooms: { total: 20, available: 15, occupied: 5, maintenance: 0 } }),
    ])
    const text = wrapper.text()
    expect(text).toContain('100%')
    expect(text).toContain('25%')
    expect(text).toContain('Toa Full')
    expect(text).toContain('Toa Half')
  })

  it('sets bar segment width per row (per-row 100% basis), not normalized cross-row', () => {
    const wrapper = mountList([
      buildBuilding({ name: 'Big', rooms: { total: 100, available: 50, occupied: 50, maintenance: 0 } }),
      buildBuilding({ id: 'b2', slug: 'b', name: 'Small', rooms: { total: 4, available: 2, occupied: 2, maintenance: 0 } }),
    ])
    const html = wrapper.html()
    // Both should compute 50% occupied — proving per-row basis (not cross-row norm)
    const matches = html.match(/width:\s*50%/g) ?? []
    // Each row has 2 segments at 50% (occupied + available) → 4 matches
    expect(matches.length).toBeGreaterThanOrEqual(4)
  })

  it('handles zero-room building gracefully', () => {
    const wrapper = mountList([
      buildBuilding({ rooms: { total: 0, available: 0, occupied: 0, maintenance: 0 } }),
    ])
    expect(wrapper.text()).toContain('0/0 phòng')
  })
})
