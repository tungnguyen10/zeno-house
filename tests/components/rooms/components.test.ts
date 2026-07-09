import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import RoomListToolbar from '../../../app/components/rooms/RoomListToolbar.vue'
import RoomBulkActionsBar from '../../../app/components/rooms/RoomBulkActionsBar.vue'
import RoomDetailHero from '../../../app/components/rooms/RoomDetailHero.vue'
import RoomCard from '../../../app/components/rooms/RoomCard.vue'
import UiSearchInput from '../../../app/components/ui/UiSearchInput.vue'
import UiFilterChips from '../../../app/components/ui/UiFilterChips.vue'
import UiSortControl from '../../../app/components/ui/UiSortControl.vue'
import type { Room } from '../../../app/types/rooms'
import type { Building } from '../../../app/types/buildings'
import type { RoomBulkResult } from '../../../app/composables/rooms/useRoomBulkActions'

vi.stubGlobal('useFetch', vi.fn(() => ({
  data: ref({ data: [{ id: 'b-1', name: 'Toa A' }] }),
})))

const bulkRunAction = vi.fn(
  async (): Promise<RoomBulkResult> => ({ succeeded: [], failed: [] }),
)

const iconStub = defineComponent({ template: '<span />' })

const stubs = {
  IconSearch: iconStub,
  IconArrowUp: iconStub,
  IconDoor: iconStub,
  IconLayers: iconStub,
  IconUsers: iconStub,
  IconChart: iconStub,
  IconBuilding: iconStub,
  IconTag: iconStub,
  IconDocumentText: iconStub,
  IconChevronDown: iconStub,
  UiToolbar: defineComponent({
    setup(_, { slots }) {
      return () => h('div', { 'data-test': 'toolbar' }, [slots.default?.(), slots.actions?.()])
    },
  }),
  UiSearchInput,
  UiFilterChips,
  UiSortControl,
  UiInput: defineComponent({
    props: ['modelValue', 'placeholder', 'type'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('input', {
        'data-test': 'input',
        'value': props.modelValue,
        'placeholder': props.placeholder,
        'type': props.type ?? 'text',
        'onInput': (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      })
    },
  }),
  UiButton: defineComponent({
    props: ['variant', 'disabled', 'iconOnly', 'ariaLabel', 'size'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h(
        'button',
        { disabled: props.disabled, onClick: () => emit('click'), 'data-test': 'btn' },
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
          ])
        : null
    },
  }),
  UiTextarea: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('textarea', {
        'data-test': 'textarea',
        value: props.modelValue,
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLTextAreaElement).value),
      })
    },
  }),
  NuxtLink: defineComponent({
    props: ['to'],
    setup(_, { slots }) { return () => h('a', {}, slots.default?.()) },
  }),
}

function buildRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r-1',
    buildingId: 'b-1',
    roomNumber: '101',
    slug: '101',
    code: 'a-101',
    floor: 1,
    status: 'available',
    monthlyRent: 3000000,
    area: 20,
    description: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: 'b-1',
    slug: 'toa-a',
    code: 'a',
    name: 'Toa A',
    address: '123',
    description: null,
    status: 'active',
    totalRooms: 1,
    serviceSummary: { totalCount: 0, activeCount: 0, activeNames: [] },
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

describe('RoomListToolbar', () => {
  it('debounces search input before emitting update:q', async () => {
    vi.useFakeTimers()
    const wrapper = mount(RoomListToolbar, {
      props: { q: '', status: [], sort: 'floor', order: 'asc' },
      global: { stubs },
    })

    const input = wrapper.find('input[type="search"]')
    await input.setValue('a101')
    expect(wrapper.emitted('update:q')).toBeUndefined()

    vi.advanceTimersByTime(300)
    await nextTick()

    expect(wrapper.emitted('update:q')).toEqual([['a101']])
    vi.useRealTimers()
  })

  it('toggles a status chip', async () => {
    const wrapper = mount(RoomListToolbar, {
      props: { q: '', status: [], sort: 'floor', order: 'asc' },
      global: { stubs },
    })

    const chip = wrapper.findAll('button').find(b => b.text().includes('Trống'))!
    await chip.trigger('click')
    expect(wrapper.emitted('update:status')).toEqual([[['available']]])
  })

  it('emits sort change', async () => {
    const wrapper = mount(RoomListToolbar, {
      props: { q: '', status: [], sort: 'floor', order: 'asc' },
      global: { stubs },
    })

    const selects = wrapper.findAll('[data-test="select"]')
    await selects[1]!.setValue('monthly_rent')
    expect(wrapper.emitted('update:sort')).toEqual([['monthly_rent']])
  })
})

describe('RoomBulkActionsBar', () => {
  it('displays selected count and opens confirm modal', async () => {
    const wrapper = mount(RoomBulkActionsBar, {
      props: { selectedIds: ['r-1'], rooms: [buildRoom()], runAction: bulkRunAction, isRunning: false },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('1 đã chọn')

    const archive = wrapper.findAll('button').find(b => b.text().includes('Lưu trữ'))!
    await archive.trigger('click')
    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Phòng 101')
  })

  it('requires reason before running delete action', async () => {
    const runAction = vi.fn(async (): Promise<RoomBulkResult> => ({ succeeded: ['r-1'], failed: [] }))
    const wrapper = mount(RoomBulkActionsBar, {
      props: { selectedIds: ['r-1'], rooms: [buildRoom()], runAction, isRunning: false },
      global: { stubs },
    })

    const del = wrapper.findAll('button').find(b => b.text().includes('Xoá nhiều'))!
    await del.trigger('click')

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('[data-test="confirm"]').trigger('click')
    expect(runAction).not.toHaveBeenCalled()

    await wrapper.find('[data-test="textarea"]').setValue('Dữ liệu phòng bị nhập trùng')
    await wrapper.find('[data-test="confirm"]').trigger('click')
    expect(runAction).toHaveBeenCalledWith('delete', { reason: 'Dữ liệu phòng bị nhập trùng' })
  })
})

describe('RoomDetailHero', () => {
  it('renders room identity and stat tiles', () => {
    const wrapper = mount(RoomDetailHero, {
      props: {
        room: buildRoom({ status: 'archived' }),
        building: buildBuilding(),
        activeContract: null,
        occupantCount: 3,
        meterDeviceCount: 2,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Toa A')
    expect(wrapper.text()).toContain('#a-101')
    expect(wrapper.text()).toContain('3 người')
    expect(wrapper.text()).toContain('2 đồng hồ')
    expect(wrapper.find('[data-test="status"]').attributes('data-status')).toBe('archived')
  })
})

describe('RoomCard selection mode', () => {
  it('does not render a checkbox by default', () => {
    const wrapper = mount(RoomCard, {
      props: { room: buildRoom() },
      global: { stubs },
    })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('renders a checkbox when selectable and emits toggle-select', async () => {
    const wrapper = mount(RoomCard, {
      props: { room: buildRoom(), selectable: true, selected: false },
      global: { stubs },
    })

    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('toggle-select')).toEqual([['r-1']])
  })
})
