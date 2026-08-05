import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import BillingIncidentalChargeModal from '../../../app/components/billing/BillingIncidentalChargeModal.vue'
import UiInput from '../../../app/components/ui/UiInput.vue'
import UiTextarea from '../../../app/components/ui/UiTextarea.vue'
import type { BillingDraftGridRow, BillingIncidentalCharge } from '../../../app/types/billing'

const toastSuccess = vi.fn()

const modalStub = defineComponent({
  props: ['open', 'title'],
  emits: ['close'],
  template: '<section v-if="open"><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></section>',
})
const buttonStub = defineComponent({
  props: ['disabled', 'loading'],
  emits: ['click'],
  template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
})
const confirmStub = defineComponent({
  props: ['open'],
  emits: ['confirm', 'cancel'],
  template: '<button v-if="open" data-test="confirm-delete" @click="$emit(\'confirm\')">Xác nhận xóa</button>',
})

function row(editable = true): BillingDraftGridRow {
  return {
    key: 'contract:00000000-0000-4000-8000-000000000001',
    rowType: 'billable_contract',
    roomId: '00000000-0000-4000-8000-000000000002',
    roomNumber: '101',
    floor: 1,
    contractId: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000003',
    tenantName: 'Nguyễn Văn An',
    contractCode: 'HD-101',
    invoiceId: null,
    invoiceStatus: null,
    editable,
    status: 'ready',
    electricity: null,
    water: null,
    rentAndServiceTotal: 3_000_000,
    draftTotal: 3_000_000,
    blockers: [],
    warnings: [],
    lines: [],
  }
}

function charge(): BillingIncidentalCharge {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    billingPeriodId: '00000000-0000-4000-8000-000000000020',
    contractId: '00000000-0000-4000-8000-000000000001',
    roomId: '00000000-0000-4000-8000-000000000002',
    label: 'Thay khóa cửa',
    amount: 150_000,
    note: 'Theo biên bản bàn giao',
    operationId: '00000000-0000-4000-8000-000000000030',
    createdBy: '00000000-0000-4000-8000-000000000040',
    createdAt: '2026-08-05T01:00:00.000Z',
    updatedAt: '2026-08-05T02:00:00.000Z',
  }
}

function mountModal(overrides: { charge?: BillingIncidentalCharge | null } = {}) {
  const onCreate = vi.fn().mockResolvedValue(charge())
  const onUpdate = vi.fn().mockResolvedValue(charge())
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(BillingIncidentalChargeModal, {
    props: {
      open: true,
      row: row(),
      charge: overrides.charge ?? null,
      onCreate,
      onUpdate,
      onDelete,
    },
    global: {
      components: { UiInput, UiTextarea },
      stubs: {
        UiModal: modalStub,
        UiButton: buttonStub,
        UiAlert: defineComponent({ template: '<div role="alert"><slot /></div>' }),
        UiConfirmModal: confirmStub,
      },
    },
  })
  return { wrapper, onCreate, onUpdate, onDelete }
}

describe('BillingIncidentalChargeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useToast', () => ({ success: toastSuccess }))
  })

  it('validates positive money and creates a period-only charge', async () => {
    const { wrapper, onCreate } = mountModal()
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('Thay khóa cửa')
    await inputs[1]!.setValue('150000')
    await wrapper.get('textarea').setValue('Theo biên bản bàn giao')
    await wrapper.findAll('button').find(button => button.text() === 'Thêm khoản')!.trigger('click')
    await flushPromises()

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      contract_id: '00000000-0000-4000-8000-000000000001',
      label: 'Thay khóa cửa',
      amount: 150_000,
      note: 'Theo biên bản bàn giao',
      operation_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    }))
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('rejects an empty name and non-positive amount before calling the API', async () => {
    const { wrapper, onCreate } = mountModal()
    await wrapper.findAll('input')[1]!.setValue('0')
    await wrapper.findAll('button').find(button => button.text() === 'Thêm khoản')!.trigger('click')

    expect(onCreate).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cần nhập tên khoản phát sinh')
    expect(wrapper.text()).toContain('Số tiền phải là số nguyên lớn hơn 0')
  })

  it('updates and deletes with the latest optimistic timestamp', async () => {
    const existing = charge()
    const { wrapper, onUpdate, onDelete } = mountModal({ charge: existing })
    await wrapper.findAll('input')[0]!.setValue('Thay khóa cổng')
    await wrapper.findAll('button').find(button => button.text() === 'Lưu thay đổi')!.trigger('click')
    await flushPromises()

    expect(onUpdate).toHaveBeenCalledWith(existing.id, expect.objectContaining({
      label: 'Thay khóa cổng',
      expected_updated_at: existing.updatedAt,
    }))

    await wrapper.findAll('button').find(button => button.text() === 'Xóa khoản')!.trigger('click')
    await wrapper.get('[data-test="confirm-delete"]').trigger('click')
    await flushPromises()
    expect(onDelete).toHaveBeenCalledWith(existing.id, existing.updatedAt)
  })
})
