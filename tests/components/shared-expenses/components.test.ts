import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import SharedExpenseFormModal from '../../../app/components/shared-expenses/SharedExpenseFormModal.vue'
import SharedExpenseAllocationModal from '../../../app/components/shared-expenses/SharedExpenseAllocationModal.vue'
import SharedExpenseMobileRow from '../../../app/components/shared-expenses/SharedExpenseMobileRow.vue'
import SharedExpenseList from '../../../app/components/shared-expenses/SharedExpenseList.vue'
import type { Building } from '../../../app/types/buildings'
import type { SharedExpenseListItem } from '../../../app/types/shared-expenses'

const building = (id: string, name: string) => ({ id, name }) as Building
const BUILDING_ONE = '11111111-1111-4111-8111-111111111111'
const BUILDING_TWO = '22222222-2222-4222-8222-222222222222'
const buildings = [building(BUILDING_ONE, 'Tòa A'), building(BUILDING_TWO, 'Tòa B')]

const expense = (overrides: Partial<SharedExpenseListItem> = {}): SharedExpenseListItem => ({
  id: 'shared-1',
  ownerId: 'owner-1',
  name: 'Bảo vệ',
  category: 'staff',
  amount: 1_001,
  note: 'Ca đêm',
  isActive: true,
  isAllocatedForPeriod: false,
  buildingIds: [BUILDING_ONE, BUILDING_TWO],
  createdBy: 'owner-1',
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

const UiModal = defineComponent({
  props: ['open', 'title'],
  setup(props, { slots }) {
    return () => props.open
      ? h('section', { 'data-test': 'modal' }, [
          h('h2', {}, props.title),
          slots.default?.(),
          h('footer', {}, slots.footer?.()),
        ])
      : null
  },
})

const UiButton = defineComponent({
  props: ['type', 'disabled', 'loading', 'ariaLabel'],
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      type: props.type ?? 'button',
      disabled: props.disabled || props.loading,
      'aria-label': props.ariaLabel,
      onClick: () => emit('click'),
    }, slots.default?.())
  },
})

const fieldStub = (tag: 'input' | 'textarea' | 'select' = 'input') => defineComponent({
  props: ['modelValue', 'error', 'label', 'options'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('label', {}, [
      props.label,
      h(tag, {
        value: props.modelValue ?? '',
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
        onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }, tag === 'select'
        ? (props.options ?? []).map((option: { value: string; label: string }) =>
            h('option', { value: option.value }, option.label))
        : undefined),
      props.error ? h('span', { 'data-error': props.label }, props.error) : null,
    ])
  },
})

const UiCheckbox = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('label', {}, [
      h('input', {
        type: 'checkbox',
        checked: props.modelValue,
        onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
      }),
      props.label,
    ])
  },
})

const stubs = {
  UiModal,
  UiButton,
  UiCombobox: fieldStub(),
  UiInput: fieldStub(),
  UiSelect: fieldStub('select'),
  UiTextarea: fieldStub('textarea'),
  UiCheckbox,
  UiAlert: defineComponent({ setup(_, { slots }) { return () => h('div', { role: 'alert' }, slots.default?.()) } }),
  UiBadge: defineComponent({ setup(_, { slots }) { return () => h('span', {}, slots.default?.()) } }),
  UiSkeleton: defineComponent({ setup() { return () => h('span') } }),
  UiStatusBadge: defineComponent({ props: ['status'], setup(props) { return () => h('span', {}, props.status) } }),
  UiSurfacePanel: defineComponent({ setup(_, { slots }) { return () => h('article', {}, slots.default?.()) } }),
  UiDropdownMenu: defineComponent({ setup(_, { slots }) { return () => h('div', {}, slots.default?.()) } }),
  UiDropdownMenuItem: defineComponent({
    emits: ['click'],
    setup(_, { slots, emit }) { return () => h('button', { onClick: () => emit('click') }, slots.default?.()) },
  }),
  IconLayers: true,
  IconPencilSquare: true,
  IconPauseCircle: true,
  IconPlayCircle: true,
}

describe('SharedExpenseFormModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows inline validation and emits no submit for an empty form', async () => {
    const wrapper = mount(SharedExpenseFormModal, {
      props: { open: true, expense: null, buildings, saving: false, nameSuggestions: [] },
      global: { stubs },
    })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Tên chi phí là bắt buộc')
    expect(wrapper.text()).toContain('Số tiền phải lớn hơn 0')
    expect(wrapper.text()).toContain('Chọn ít nhất một tòa nhà')
  })

  it('prefills edit values and emits a validated payload', async () => {
    const wrapper = mount(SharedExpenseFormModal, {
      props: { open: true, expense: expense(), buildings, saving: false, nameSuggestions: ['Bảo vệ'] },
      global: { stubs },
    })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('Sửa khoản chi')
    expect(wrapper.emitted('submit')?.[0]).toEqual([{
      name: 'Bảo vệ',
      category: 'staff',
      amount: 1_001,
      note: 'Ca đêm',
      building_ids: [BUILDING_ONE, BUILDING_TWO],
    }])
  })
})

describe('SharedExpenseAllocationModal', () => {
  it('renders period-aware preview and then the generated result', async () => {
    const wrapper = mount(SharedExpenseAllocationModal, {
      props: {
        open: true,
        expense: expense(),
        buildings,
        periodYear: 2026,
        periodMonth: 7,
        loading: false,
        error: null,
        result: null,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('07/2026')
    expect(wrapper.text()).toContain('500 ₫')
    expect(wrapper.text()).toContain('501 ₫')
    await wrapper.findAll('button').find(button => button.text().includes('Phân bổ'))!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    await wrapper.setProps({
      result: {
        sharedExpenseId: 'shared-1',
        periodYear: 2026,
        periodMonth: 7,
        generatedExpenses: [
          { buildingId: BUILDING_ONE, expenseId: 'expense-1', amount: 500 },
          { buildingId: BUILDING_TWO, expenseId: 'expense-2', amount: 501 },
        ],
      },
    })
    await nextTick()

    expect(wrapper.text()).toContain('Đã tạo 2 khoản chi')
    expect(wrapper.text()).toContain('Tòa A')
  })
})

describe('SharedExpenseMobileRow', () => {
  it('keeps lifecycle and period status visible without table markup', async () => {
    const wrapper = mount(SharedExpenseMobileRow, {
      props: {
        item: expense({ isAllocatedForPeriod: true }),
        buildingCount: 2,
        canWrite: true,
        canAllocate: true,
        allocating: false,
        deactivating: false,
        reactivating: false,
      },
      global: { stubs },
    })

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bảo vệ')
    expect(wrapper.text()).toContain('2 tòa nhà')
    expect(wrapper.text()).toContain('active')
    expect(wrapper.text()).toContain('allocated')
    expect(wrapper.text()).toContain('Đã phân bổ')
  })

  it('disables allocation for inactive rows and exposes reactivation', async () => {
    const wrapper = mount(SharedExpenseMobileRow, {
      props: {
        item: expense({ isActive: false }),
        buildingCount: 2,
        canWrite: true,
        canAllocate: true,
        allocating: false,
        deactivating: false,
        reactivating: false,
      },
      global: { stubs },
    })

    const allocationButton = wrapper.findAll('button')
      .find(button => button.text().includes('Phân bổ'))
    expect(allocationButton?.attributes('disabled')).toBeDefined()

    const reactivateButton = wrapper.findAll('button')
      .find(button => button.text().includes('Kích hoạt lại'))
    await reactivateButton!.trigger('click')
    expect(wrapper.emitted('reactivate')).toHaveLength(1)
  })
})

describe('SharedExpenseList', () => {
  it('renders separate desktop and mobile surfaces with period-aware actions', () => {
    const wrapper = mount(SharedExpenseList, {
      props: {
        items: [expense()],
        buildings,
        loading: false,
        canWrite: true,
        canAllocate: true,
        allocatingId: null,
        deactivatingId: null,
        reactivatingId: null,
      },
      global: {
        stubs: {
          ...stubs,
          UiTable: defineComponent({
            setup(_, { slots }) {
              return () => h('div', { 'data-test': 'desktop-table' }, slots.default?.({ row: expense() }))
            },
          }),
          SharedExpenseMobileRow,
        },
      },
    })

    expect(wrapper.find('[data-shared-expenses-desktop]').classes()).toContain('md:block')
    expect(wrapper.find('[data-shared-expenses-mobile]').classes()).toContain('md:hidden')
    expect(wrapper.text()).toContain('Bảo vệ')
  })
})
