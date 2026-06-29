import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContractListToolbar from '../../../app/components/contracts/ContractListToolbar.vue'
import ContractBulkActionsBar from '../../../app/components/contracts/ContractBulkActionsBar.vue'
import ContractDetailHero from '../../../app/components/contracts/ContractDetailHero.vue'
import ContractWizardSteps from '../../../app/components/contracts/ContractWizardSteps.vue'
import UiSearchInput from '../../../app/components/ui/UiSearchInput.vue'
import UiFilterChips from '../../../app/components/ui/UiFilterChips.vue'
import UiSortControl from '../../../app/components/ui/UiSortControl.vue'
import type { ContractWithDetails } from '../../../app/types/contracts'
import type { ContractBulkActionResult } from '../../../app/composables/contracts/useContractBulkActions'

const iconStub = defineComponent({ template: '<span />' })

const stubs = {
  IconSearch: iconStub,
  IconArrowUp: iconStub,
  IconChevronDown: iconStub,
  UiToolbar: defineComponent({
    setup(_, { slots }) {
      return () => h('div', { 'data-test': 'toolbar' }, [slots.default?.(), slots.actions?.()])
    },
  }),
  UiSearchInput,
  UiFilterChips,
  UiSortControl,
  UiFilterPopover: defineComponent({
    setup(_, { slots }) {
      return () => h('div', { 'data-test': 'filter' }, slots.default?.())
    },
  }),
  UiButton: defineComponent({
    props: ['disabled', 'loading'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h('button', { disabled: props.disabled || props.loading, onClick: () => emit('click') }, slots.default?.())
    },
  }),
  UiSelect: defineComponent({
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h(
        'select',
        { value: props.modelValue, onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value) },
        (props.options as { value: string, label: string }[]).map(option => h('option', { value: option.value }, option.label)),
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
  UiTextarea: defineComponent({
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('textarea', {
        value: props.modelValue,
        'aria-label': props.label,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      })
    },
  }),
  UiConfirmModal: defineComponent({
    props: ['open', 'title', 'confirmLabel'],
    emits: ['confirm', 'cancel'],
    setup(props, { slots, emit }) {
      return () => props.open
        ? h('div', { 'data-test': 'confirm-modal' }, [
            h('h3', props.title),
            slots.default?.(),
            h('button', { 'data-test': 'confirm', onClick: () => emit('confirm') }, props.confirmLabel),
          ])
        : null
    },
  }),
  NuxtLink: defineComponent({
    props: ['to'],
    setup(_, { slots }) {
      return () => h('a', {}, slots.default?.())
    },
  }),
}

function buildContract(overrides: Partial<ContractWithDetails> = {}): ContractWithDetails {
  return {
    id: 'c-1',
    contractCode: 'HD-A101-001',
    roomId: 'room-1',
    tenantId: 'tenant-1',
    buildingId: 'building-1',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    monthlyRent: 3000000,
    deposit: 3000000,
    paymentDay: 5,
    occupantCount: 2,
    discountAmount: 0,
    surchargeAmount: 0,
    previousContractId: null,
    originalEndDate: null,
    renewalCount: 0,
    status: 'active',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    room: { id: 'room-1', code: 'a-101', roomNumber: 'A101', floor: 1, buildingId: 'building-1', buildingName: 'Toa A' },
    tenant: { id: 'tenant-1', code: 'tenant-a', fullName: 'An Tran', phone: '0901000001' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContractListToolbar', () => {
  it('debounces search input before emitting update:q', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ContractListToolbar, {
      props: {
        q: '',
        buildingFilter: '',
        status: [],
        sort: 'created_at',
        order: 'desc',
        buildingOptions: [],
      },
      global: { stubs },
    })

    await wrapper.find('input[type="search"]').setValue('A101')
    expect(wrapper.emitted('update:q')).toBeUndefined()
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(wrapper.emitted('update:q')).toEqual([['A101']])
    vi.useRealTimers()
  })

  it('toggles status chips and emits sort change', async () => {
    const wrapper = mount(ContractListToolbar, {
      props: {
        q: '',
        buildingFilter: '',
        status: [],
        sort: 'created_at',
        order: 'desc',
        buildingOptions: [],
      },
      global: { stubs },
    })

    const chip = wrapper.findAll('button').find(button => button.text().includes('Đang hiệu lực'))!
    await chip.trigger('click')
    expect(wrapper.emitted('update:status')).toEqual([[['active']]])

    const selects = wrapper.findAll('select')
    await selects[1]!.setValue('start_date')
    expect(wrapper.emitted('update:sort')).toEqual([['start_date']])
  })
})

describe('ContractBulkActionsBar', () => {
  it('shows count and runs terminate confirmation with reason', async () => {
    const runAction = vi.fn(async (): Promise<ContractBulkActionResult> => ({ succeeded: ['c-1'], failed: [] }))
    const wrapper = mount(ContractBulkActionsBar, {
      props: { selectedIds: ['c-1'], contracts: [buildContract()], runAction },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('1 đã chọn')
    await wrapper.findAll('button').find(button => button.text().includes('Kết thúc'))!.trigger('click')
    await wrapper.find('textarea').setValue('Khách trả phòng')
    await wrapper.find('[data-test="confirm"]').trigger('click')

    expect(runAction).toHaveBeenCalledWith('terminate', { reason: 'Khách trả phòng' })
    expect(wrapper.emitted('done')?.[0]?.[1]).toBe('terminate')
  })
})

describe('ContractDetailHero', () => {
  it('renders stat tiles and active action buttons', async () => {
    const wrapper = mount(ContractDetailHero, {
      props: { contract: buildContract(), paidAmount: 1000000 },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('HD-A101-001')
    expect(wrapper.text()).toContain('An Tran')
    expect(wrapper.text()).toContain('Phòng A101')
    expect(wrapper.find('[data-test="status"]').attributes('data-status')).toBe('active')

    await wrapper.findAll('button').find(button => button.text().includes('Gia hạn'))!.trigger('click')
    expect(wrapper.emitted('renew')).toHaveLength(1)
  })

  it('hides active action buttons for terminated contracts', () => {
    const wrapper = mount(ContractDetailHero, {
      props: { contract: buildContract({ status: 'terminated' }) },
      global: { stubs },
    })

    expect(wrapper.text()).not.toContain('Gia hạn')
    expect(wrapper.text()).not.toContain('Kết thúc sớm')
  })
})

describe('ContractWizardSteps', () => {
  it('highlights current step, shows completed check, and blocks future steps', async () => {
    const wrapper = mount(ContractWizardSteps, {
      props: { currentStep: 2, completedSteps: [1] },
    })

    expect(wrapper.text()).toContain('✓')
    const buttons = wrapper.findAll('button')
    expect(buttons[2]!.attributes('disabled')).toBeDefined()
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('change')).toEqual([[1]])
  })
})
