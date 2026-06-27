import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import TenantListToolbar from '../../../app/components/tenants/TenantListToolbar.vue'
import TenantDetailHero from '../../../app/components/tenants/TenantDetailHero.vue'
import TenantBulkActionsBar from '../../../app/components/tenants/TenantBulkActionsBar.vue'
import UiSearchInput from '../../../app/components/ui/UiSearchInput.vue'
import UiFilterChips from '../../../app/components/ui/UiFilterChips.vue'
import UiSortControl from '../../../app/components/ui/UiSortControl.vue'
import type { Tenant } from '../../../app/types/tenants'
import type { TenantBulkResult } from '../../../app/composables/tenants/useTenantBulkActions'

vi.stubGlobal('$fetch', vi.fn())

const bulkRunAction = vi.fn(
  async (): Promise<TenantBulkResult> => ({ succeeded: [], failed: [] }),
)

const iconStub = defineComponent({ template: '<span />' })

const stubs = {
  IconSearch: iconStub,
  IconArrowUp: iconStub,
  IconMail: iconStub,
  IconPhone: iconStub,
  IconDocument: iconStub,
  IconDocumentText: iconStub,
  IconDoor: iconStub,
  IconUsers: iconStub,
  IconChevronDown: iconStub,
  UiToolbar: defineComponent({
    setup(_, { slots }) {
      return () => h('div', { 'data-test': 'toolbar' }, [slots.default?.(), slots.actions?.()])
    },
  }),
  UiSearchInput,
  UiFilterChips,
  UiSortControl,
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
    props: ['variant', 'pill'],
    setup(_, { slots }) {
      return () => h('span', { 'data-test': 'badge' }, slots.default?.())
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

function buildTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't-1',
    code: 'nva-2026-0001',
    fullName: 'Nguyễn Văn A',
    phone: '0901234567',
    email: '[email protected]',
    idNumber: '012345678901',
    dateOfBirth: null,
    permanentAddress: null,
    notes: null,
    gender: null,
    occupation: null,
    idIssuedDate: null,
    idIssuedPlace: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    status: 'active',
    hasActiveContract: false,
    activeAssignment: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// TenantListToolbar
// ---------------------------------------------------------------------------

describe('TenantListToolbar', () => {
  const baseProps = {
    q: '',
    buildingFilter: '',
    contractStateFilter: '' as const,
    status: [] as Tenant['status'][],
    sort: 'full_name' as const,
    order: 'asc' as const,
    buildingOptions: [
      { value: 'b-1', label: 'Toa A' },
      { value: 'b-2', label: 'Toa B' },
    ],
  }

  it('debounces search input before emitting update:q', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TenantListToolbar, {
      props: baseProps,
      global: { stubs },
    })

    const input = wrapper.find('input[type="search"]')
    await input.setValue('binh')
    expect(wrapper.emitted('update:q')).toBeUndefined()

    vi.advanceTimersByTime(300)
    await nextTick()

    expect(wrapper.emitted('update:q')).toEqual([['binh']])
    vi.useRealTimers()
  })

  it('toggles a status chip via aria-pressed buttons', async () => {
    const wrapper = mount(TenantListToolbar, {
      props: baseProps,
      global: { stubs },
    })

    const activeChip = wrapper.findAll('button').find(b => b.text().includes('Đang hoạt động'))!
    await activeChip.trigger('click')
    expect(wrapper.emitted('update:status')).toEqual([[['active']]])
  })

  it('removes a chip when clicked twice', async () => {
    const wrapper = mount(TenantListToolbar, {
      props: { ...baseProps, status: ['active'] },
      global: { stubs },
    })

    const activeChip = wrapper.findAll('button').find(b => b.text().includes('Đang hoạt động'))!
    await activeChip.trigger('click')
    expect(wrapper.emitted('update:status')).toEqual([[[]]])
  })

  it('emits sort change when sort dropdown changes', async () => {
    const wrapper = mount(TenantListToolbar, {
      props: baseProps,
      global: { stubs },
    })

    const selects = wrapper.findAll('[data-test="select"]')
    // sort select is the last one (after building + contract state)
    const sortSelect = selects[selects.length - 1]!
    await sortSelect.setValue('created_at')
    expect(wrapper.emitted('update:sort')).toEqual([['created_at']])
  })

  it('emits building filter changes', async () => {
    const wrapper = mount(TenantListToolbar, {
      props: baseProps,
      global: { stubs },
    })

    const selects = wrapper.findAll('[data-test="select"]')
    const buildingSelect = selects[0]!
    await buildingSelect.setValue('b-1')
    expect(wrapper.emitted('update:buildingFilter')).toEqual([['b-1']])
  })
})

// ---------------------------------------------------------------------------
// TenantDetailHero
// ---------------------------------------------------------------------------

describe('TenantDetailHero', () => {
  it('renders fullName, code, status, and contact chips', () => {
    const wrapper = mount(TenantDetailHero, {
      props: {
        tenant: buildTenant(),
        activeContractCount: 1,
        currentRoomLabel: 'A101 — Toa A',
        occupancyCount: 0,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Nguyễn Văn A')
    expect(wrapper.text()).toContain('#nva-2026-0001')
    expect(wrapper.text()).toContain('Đang hoạt động')
    expect(wrapper.text()).toContain('0901234567')
    expect(wrapper.text()).toContain('012345678901')
    expect(wrapper.text()).toContain('A101 — Toa A')
    expect(wrapper.text()).toContain('1')
  })

  it('renders archived badge when status is archived', () => {
    const wrapper = mount(TenantDetailHero, {
      props: {
        tenant: buildTenant({ status: 'archived' }),
      },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Đã lưu trữ')
  })

  it('falls back to em dash when no current room', () => {
    const wrapper = mount(TenantDetailHero, {
      props: { tenant: buildTenant(), currentRoomLabel: null },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('—')
  })
})

// ---------------------------------------------------------------------------
// TenantBulkActionsBar
// ---------------------------------------------------------------------------

describe('TenantBulkActionsBar', () => {
  it('displays the selected count', () => {
    const tenants = [buildTenant({ id: 'a' }), buildTenant({ id: 'b' })]
    const wrapper = mount(TenantBulkActionsBar, {
      props: { selectedIds: ['a', 'b'], tenants, runAction: bulkRunAction, isRunning: false },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('2 đã chọn')
  })

  it('opens the confirm modal listing the selected names', async () => {
    const tenants = [
      buildTenant({ id: 'a', fullName: 'Khách A' }),
      buildTenant({ id: 'b', fullName: 'Khách B' }),
    ]
    const wrapper = mount(TenantBulkActionsBar, {
      props: { selectedIds: ['a', 'b'], tenants, runAction: bulkRunAction, isRunning: false },
      global: { stubs },
    })

    const archive = wrapper.findAll('button').find(b => b.text().includes('Lưu trữ'))!
    await archive.trigger('click')

    expect(wrapper.find('[data-test="confirm-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Khách A')
    expect(wrapper.text()).toContain('Khách B')
  })

  it('shows the irreversible acknowledgement only for delete', async () => {
    const tenants = [buildTenant({ id: 'a' })]
    const wrapper = mount(TenantBulkActionsBar, {
      props: { selectedIds: ['a'], tenants, runAction: bulkRunAction, isRunning: false },
      global: { stubs },
    })

    const archive = wrapper.findAll('button').find(b => b.text().includes('Lưu trữ'))!
    await archive.trigger('click')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)

    // Close, then open delete
    await wrapper.find('[data-test="cancel"]').trigger('click')
    const del = wrapper.findAll('button').find(b => b.text().includes('Xoá nhiều'))!
    await del.trigger('click')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })
})
