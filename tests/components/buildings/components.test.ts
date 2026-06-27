import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import BuildingListToolbar from '../../../app/components/buildings/BuildingListToolbar.vue'
import BuildingDetailHero from '../../../app/components/buildings/BuildingDetailHero.vue'
import BuildingBulkActionsBar from '../../../app/components/buildings/BuildingBulkActionsBar.vue'
import BuildingCard from '../../../app/components/buildings/BuildingCard.vue'
import type { Building } from '../../../app/types/buildings'
import type { BuildingBulkResult } from '../../../app/composables/buildings/useBuildingBulkActions'

vi.stubGlobal('$fetch', vi.fn())

const bulkRunAction = vi.fn(
  async (): Promise<BuildingBulkResult> => ({ succeeded: [], failed: [] }),
)

const iconStub = defineComponent({ template: '<span />' })

const stubs = {
  IconSearch: iconStub,
  IconArrowUp: iconStub,
  IconMapPin: iconStub,
  IconDoor: iconStub,
  IconUsers: iconStub,
  IconLayers: iconStub,
  IconBuilding: iconStub,
  IconChevronDown: iconStub,
  UiToolbar: defineComponent({
    setup(_, { slots }) {
      return () => h('div', { 'data-test': 'toolbar' }, [slots.default?.(), slots.actions?.()])
    },
  }),
  UiButton: defineComponent({
    props: ['variant', 'disabled', 'iconOnly', 'ariaLabel', 'size'],
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h(
        'button',
        { onClick: () => emit('click'), 'data-test': 'btn' },
        slots.default?.(),
      )
    },
  }),
  UiSelect: defineComponent({
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h(
        'select',
        {
          'data-test': 'select',
          'value': props.modelValue,
          'onChange': (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value),
        },
        (props.options as { value: string; label: string }[]).map(o =>
          h('option', { value: o.value }, o.label),
        ),
      )
    },
  }),
  UiBadge: defineComponent({
    setup(_, { slots }) {
      return () => h('span', { 'data-test': 'badge' }, slots.default?.())
    },
  }),
  UiStatusBadge: defineComponent({
    props: ['status'],
    setup(props) {
      return () => h('span', { 'data-test': 'status', 'data-status': props.status })
    },
  }),
  UiConfirmModal: defineComponent({
    props: ['open', 'title', 'message', 'confirmLabel', 'loading'],
    emits: ['confirm', 'cancel'],
    setup(props, { slots, emit }) {
      return () => props.open
        ? h('div', { 'data-test': 'confirm-modal' }, [
            h('h3', {}, props.title),
            slots.default?.(),
            h('button', { 'data-test': 'confirm', onClick: () => emit('confirm') }, props.confirmLabel),
            h('button', { 'data-test': 'cancel', onClick: () => emit('cancel') }, 'Huỷ'),
          ])
        : null
    },
  }),
  NuxtLink: defineComponent({
    props: ['to'],
    setup(_, { slots }) { return () => h('a', {}, slots.default?.()) },
  }),
}

function buildBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: 'b-1',
    slug: 'toa-a',
    code: 'a',
    name: 'Toa A',
    address: '123 Đường ABC',
    description: null,
    status: 'active',
    totalRooms: 12,
    serviceSummary: { totalCount: 3, activeCount: 2, activeNames: ['Wifi', 'Vệ sinh'] },
    ownerName: null,
    ownerPhone: null,
    ownerEmail: null,
    electricityPricingType: 'per_kwh',
    defaultElectricityRate: null,
    waterPricingType: 'per_m3',
    defaultWaterRate: null,
    meterReadingDay: null,
    billingGenerationDay: null,
    paymentDueDay: null,
    gracePeriodDays: 0,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// BuildingListToolbar
// ---------------------------------------------------------------------------

describe('BuildingListToolbar', () => {
  it('debounces search input before emitting update:q', async () => {
    vi.useFakeTimers()
    const wrapper = mount(BuildingListToolbar, {
      props: { q: '', status: [], sort: 'created_at', order: 'desc' },
      global: { stubs },
    })

    const input = wrapper.find('input[type="search"]')
    await input.setValue('sunrise')
    expect(wrapper.emitted('update:q')).toBeUndefined()

    vi.advanceTimersByTime(300)
    await nextTick()

    expect(wrapper.emitted('update:q')).toEqual([['sunrise']])
    vi.useRealTimers()
  })

  it('toggles a status chip via aria-pressed buttons', async () => {
    const wrapper = mount(BuildingListToolbar, {
      props: { q: '', status: [], sort: 'created_at', order: 'desc' },
      global: { stubs },
    })

    const activeChip = wrapper.findAll('button').find(b => b.text().includes('Đang hoạt động'))!
    await activeChip.trigger('click')
    expect(wrapper.emitted('update:status')).toEqual([[['active']]])
  })

  it('removes a chip when clicked twice', async () => {
    const wrapper = mount(BuildingListToolbar, {
      props: { q: '', status: ['active'], sort: 'created_at', order: 'desc' },
      global: { stubs },
    })

    const activeChip = wrapper.findAll('button').find(b => b.text().includes('Đang hoạt động'))!
    await activeChip.trigger('click')
    expect(wrapper.emitted('update:status')).toEqual([[[]]])
  })

  it('emits sort change when the dropdown changes', async () => {
    const wrapper = mount(BuildingListToolbar, {
      props: { q: '', status: [], sort: 'created_at', order: 'desc' },
      global: { stubs },
    })

    const select = wrapper.find('[data-test="select"]')
    await select.setValue('name')
    expect(wrapper.emitted('update:sort')).toEqual([['name']])
  })
})

// ---------------------------------------------------------------------------
// BuildingDetailHero
// ---------------------------------------------------------------------------

describe('BuildingDetailHero', () => {
  it('renders quick stats for rooms, occupied, services', () => {
    const wrapper = mount(BuildingDetailHero, {
      props: { building: buildBuilding(), occupiedRooms: 9, activeServices: 4 },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('9')
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).toContain('Toa A')
    expect(wrapper.text()).toContain('#a')
  })

  it('shows "Thêm phòng" link when totalRooms is zero', () => {
    const wrapper = mount(BuildingDetailHero, {
      props: { building: buildBuilding({ totalRooms: 0 }), occupiedRooms: 0, activeServices: 0 },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Thêm phòng')
  })

  it('renders status badge from building.status', () => {
    const wrapper = mount(BuildingDetailHero, {
      props: { building: buildBuilding({ status: 'inactive' }) },
      global: { stubs },
    })
    expect(wrapper.find('[data-test="status"]').attributes('data-status')).toBe('inactive')
  })
})

// ---------------------------------------------------------------------------
// BuildingBulkActionsBar
// ---------------------------------------------------------------------------

describe('BuildingBulkActionsBar', () => {
  it('displays the selected count', () => {
    const buildings = [buildBuilding({ id: 'a' }), buildBuilding({ id: 'b' })]
    const wrapper = mount(BuildingBulkActionsBar, {
      props: { selectedIds: ['a', 'b'], buildings, runAction: bulkRunAction, isRunning: false },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('2 đã chọn')
  })

  it('opens the confirm modal listing the selected names', async () => {
    const buildings = [buildBuilding({ id: 'a', name: 'Toa A' }), buildBuilding({ id: 'b', name: 'Toa B' })]
    const wrapper = mount(BuildingBulkActionsBar, {
      props: { selectedIds: ['a', 'b'], buildings, runAction: bulkRunAction, isRunning: false },
      global: { stubs },
    })

    const archive = wrapper.findAll('button').find(b => b.text().includes('Lưu trữ'))!
    await archive.trigger('click')

    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Toa A')
    expect(wrapper.text()).toContain('Toa B')
  })
})

// ---------------------------------------------------------------------------
// BuildingCard — selection mode
// ---------------------------------------------------------------------------

describe('BuildingCard selection mode', () => {
  it('does not render a checkbox by default', () => {
    const wrapper = mount(BuildingCard, {
      props: { building: buildBuilding() },
      global: { stubs },
    })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('renders a checkbox when selectable and emits toggle-select', async () => {
    const wrapper = mount(BuildingCard, {
      props: { building: buildBuilding(), selectable: true, selected: false },
      global: { stubs },
    })

    const cb = wrapper.find('input[type="checkbox"]')
    expect(cb.exists()).toBe(true)
    await cb.trigger('change')
    expect(wrapper.emitted('toggle-select')).toEqual([[buildBuilding().id]])
  })
})
