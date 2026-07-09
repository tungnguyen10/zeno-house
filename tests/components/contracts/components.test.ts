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
  IconMoreVertical: iconStub,
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
        'data-test': 'textarea',
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

  it('requires reason and ack before running delete action', async () => {
    const runAction = vi.fn(async (): Promise<ContractBulkActionResult> => ({ succeeded: ['c-1'], failed: [] }))
    const wrapper = mount(ContractBulkActionsBar, {
      props: { selectedIds: ['c-1'], contracts: [buildContract()], runAction },
      global: { stubs },
    })

    await wrapper.findAll('button').find(b => b.text().includes('Xoá'))!.trigger('click')

    // No ack and no reason — should not call runAction
    await wrapper.find('[data-test="confirm"]').trigger('click')
    expect(runAction).not.toHaveBeenCalled()

    // Ack checked but still no reason — should not call runAction
    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('[data-test="confirm"]').trigger('click')
    expect(runAction).not.toHaveBeenCalled()

    // Both ack and reason filled — should call runAction
    await wrapper.find('[data-test="textarea"]').setValue('Hợp đồng nhập sai thông tin')
    await wrapper.find('[data-test="confirm"]').trigger('click')
    expect(runAction).toHaveBeenCalledWith('delete', { reason: 'Hợp đồng nhập sai thông tin' })
  })
})

describe('ContractDetailHero', () => {
  it('renders stat tiles and exposes lifecycle actions via the Quản trị menu', async () => {
    const wrapper = mount(ContractDetailHero, {
      props: { contract: buildContract(), paidAmount: 1000000, canManage: true },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('HD-A101-001')
    expect(wrapper.text()).toContain('An Tran')
    expect(wrapper.text()).toContain('Phòng A101')
    expect(wrapper.find('[data-test="status"]').attributes('data-status')).toBe('active')
    expect(wrapper.find('[data-test="hero-actions-menu"]').exists()).toBe(false)

    await wrapper.find('[data-test="hero-actions-trigger"]').trigger('click')
    expect(wrapper.find('[data-test="hero-actions-menu"]').exists()).toBe(true)

    const menuButtons = wrapper.find('[data-test="hero-actions-menu"]').findAll('button')
    const renewBtn = menuButtons.find(b => b.text().includes('Gia hạn'))
    const terminateBtn = menuButtons.find(b => b.text().includes('Kết thúc sớm'))
    const editBtn = menuButtons.find(b => b.text().includes('Chỉnh sửa'))
    const deleteBtn = menuButtons.find(b => b.text().includes('Xoá'))
    expect(renewBtn).toBeDefined()
    expect(terminateBtn).toBeDefined()
    expect(editBtn).toBeDefined()
    expect(deleteBtn).toBeDefined()

    await renewBtn!.trigger('click')
    expect(wrapper.emitted('renew')).toHaveLength(1)
  })

  it('omits lifecycle items the contract status disallows for a manager-capable user', async () => {
    const wrapper = mount(ContractDetailHero, {
      props: { contract: buildContract({ status: 'terminated' }), canManage: true },
      global: { stubs },
    })

    await wrapper.find('[data-test="hero-actions-trigger"]').trigger('click')
    const menu = wrapper.find('[data-test="hero-actions-menu"]')
    expect(menu.text()).toContain('Chỉnh sửa')
    expect(menu.text()).not.toContain('Gia hạn')
    expect(menu.text()).not.toContain('Kết thúc sớm')
    expect(menu.text()).toContain('Xoá')
  })

  it('hides the whole Quản trị menu when the user cannot manage', () => {
    const wrapper = mount(ContractDetailHero, {
      props: { contract: buildContract(), canManage: false },
      global: { stubs },
    })

    expect(wrapper.find('[data-test="hero-actions-trigger"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="hero-actions-menu"]').exists()).toBe(false)
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
