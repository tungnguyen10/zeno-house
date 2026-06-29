import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContractForm, { type ContractFormData } from '../../../app/components/contracts/ContractForm.vue'

// ─── useFetch mock ──────────────────────────────────────────────────────────
// ContractForm calls `useFetch` for 5 endpoints. We keep mutable refs per URL
// so individual tests can swap the meter-readings response and call refresh().

interface FetchEntry {
  data: Ref<unknown>
  refresh: ReturnType<typeof vi.fn>
}

const fetchEntries = new Map<string, FetchEntry>()

function setFetch(url: string, payload: unknown) {
  let entry = fetchEntries.get(url)
  if (!entry) {
    entry = { data: ref(payload), refresh: vi.fn(async () => {}) }
    fetchEntries.set(url, entry)
  }
  else {
    entry.data.value = payload
  }
}

beforeEach(() => {
  fetchEntries.clear()
  setFetch('/api/rooms', { data: [{ id: 'room-1', roomNumber: 'A101', floor: 1, buildingId: 'building-1', monthlyRent: 3_000_000 }] })
  setFetch('/api/buildings', { data: [{ id: 'building-1', name: 'Toa A' }] })
  setFetch('/api/contracts', { data: [], meta: { total: 0 } })
  setFetch('/api/tenants', { data: [{ id: 'tenant-1', fullName: 'An Tran', phone: '0901000001' }] })
  setFetch('/api/meter-readings/latest', { data: { electricity: null, water: null } })
})

vi.stubGlobal('useFetch', (url: string) => {
  let entry = fetchEntries.get(url)
  if (!entry) {
    entry = { data: ref(null), refresh: vi.fn(async () => {}) }
    fetchEntries.set(url, entry)
  }
  return {
    data: entry.data,
    refresh: entry.refresh,
    pending: ref(false),
    error: ref(null),
    status: ref('success'),
  }
})

// ─── Stubbed UI primitives ──────────────────────────────────────────────────
const passthroughInput = defineComponent({
  props: ['modelValue', 'label', 'error', 'type', 'id', 'disabled'],
  emits: ['update:modelValue', 'blur'],
  template: `
    <label>
      <span>{{ label }}</span>
      <input :id="id" :disabled="disabled" :type="type ?? 'text'" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" @blur="$emit('blur', $event)" />
      <span v-if="error" class="error">{{ error }}</span>
    </label>
  `,
})

const passthroughSelect = defineComponent({
  props: ['modelValue', 'label', 'options', 'id', 'disabled'],
  emits: ['update:modelValue'],
  template: '<select :id="id" :disabled="disabled" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
})

const passthroughTextarea = defineComponent({
  props: ['modelValue', 'label', 'id'],
  emits: ['update:modelValue', 'blur'],
  template: '<textarea :id="id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
})

const passthroughCombobox = defineComponent({
  props: ['modelValue', 'options', 'optionKey', 'optionLabel', 'label', 'id', 'disabled'],
  emits: ['update:modelValue'],
  template: '<div class="combobox"><button :id="id" type="button" :disabled="disabled">{{ label }}</button></div>',
})

const UiButton = defineComponent({
  props: ['type', 'disabled'],
  emits: ['click'],
  template: '<button :type="type ?? \'submit\'" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
})
const UiAlert = defineComponent({ template: '<div><slot /></div>' })

function buildForm(overrides: Partial<ContractFormData> = {}): ContractFormData {
  return {
    room_id: '',
    tenant_id: '',
    start_date: '2026-06-01',
    end_date: '2027-06-01',
    monthly_rent: '',
    deposit: '',
    payment_day: '',
    occupant_count: '1',
    discount_amount: '0',
    surcharge_amount: '0',
    status: 'active',
    notes: '',
    handover_electricity_reading: '',
    handover_water_reading: '',
    handover_reading_date: '',
    ...overrides,
  }
}

function mountForm(modelValue: ContractFormData, showHandover = true, extraProps: Record<string, unknown> = {}) {
  return mount(ContractForm, {
    props: { modelValue, showHandover, ...extraProps },
    global: {
      stubs: {
        UiInput: passthroughInput,
        UiSelect: passthroughSelect,
        UiTextarea: passthroughTextarea,
        UiCombobox: passthroughCombobox,
        UiButton,
        UiAlert,
      },
    },
  })
}

describe('ContractForm — handover meter readings', () => {
  it('pre-fills handover inputs when room_id is set and the latest endpoint returns prior readings', async () => {
    setFetch('/api/meter-readings/latest', {
      data: {
        electricity: { id: 'r-e', roomId: 'room-1', meterType: 'electricity', readingValue: 1234, readingDate: '2026-05-31', periodYear: 2026, periodMonth: 5, readingType: 'monthly' },
        water: { id: 'r-w', roomId: 'room-1', meterType: 'water', readingValue: 88, readingDate: '2026-05-31', periodYear: 2026, periodMonth: 5, readingType: 'monthly' },
      },
    })

    const wrapper = mountForm(buildForm({ room_id: 'room-1' }), true)
    await flushPromises()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const lastPayload = emitted![emitted!.length - 1]![0] as ContractFormData
    expect(lastPayload.handover_electricity_reading).toBe('1234')
    expect(lastPayload.handover_water_reading).toBe('88')
  })

  it('shows soft warning when entered reading is lower than the previous reference', async () => {
    setFetch('/api/meter-readings/latest', {
      data: {
        electricity: { id: 'r-e', roomId: 'room-1', meterType: 'electricity', readingValue: 1234, readingDate: '2026-05-31', periodYear: 2026, periodMonth: 5, readingType: 'monthly' },
        water: null,
      },
    })

    const wrapper = mountForm(
      buildForm({ room_id: 'room-1', handover_electricity_reading: '1000' }),
      true,
    )
    await flushPromises()

    expect(wrapper.text()).toContain('Số mới thấp hơn số cũ')
  })

  it('does not render the handover section when showHandover is false (edit mode)', async () => {
    const wrapper = mountForm(buildForm({ room_id: 'room-1' }), false)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Số bàn giao đầu vào')
  })
})

describe('ContractForm — overhaul UI', () => {
  it('renders four numbered edit sections', async () => {
    const wrapper = mountForm(buildForm({ room_id: 'room-1', tenant_id: 'tenant-1' }), false)
    await flushPromises()

    expect(wrapper.text()).toContain('Quan hệ')
    expect(wrapper.text()).toContain('Thời hạn & Giá')
    expect(wrapper.text()).toContain('Điều khoản')
    expect(wrapper.text()).toContain('Trạng thái & Ghi chú')
  })

  it('disables room and tenant pickers when editing an active contract', async () => {
    const wrapper = mountForm(buildForm({ room_id: 'room-1', tenant_id: 'tenant-1', status: 'active' }), false)
    await flushPromises()

    const relationButtons = wrapper.findAll('.combobox button')
    expect(relationButtons).toHaveLength(2)
    expect(relationButtons[0]!.attributes('disabled')).toBeDefined()
    expect(relationButtons[1]!.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Hợp đồng đang chạy')
  })

  it('shows error summary after invalid submit', async () => {
    const wrapper = mountForm(buildForm({ start_date: '', monthly_rent: '' }), true)
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('Có')
    expect(wrapper.text()).toContain('Ngày bắt đầu')
    expect(wrapper.text()).toContain('Giá thuê / tháng')
  })

  it('shows draft restore alert and mobile sticky bar', async () => {
    const wrapper = mountForm(buildForm(), true, {
      hasDraft: true,
      draftSavedAt: '2026-06-29T00:00:00.000Z',
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Có bản nháp chưa lưu')
    expect(wrapper.text()).toContain('Khôi phục')
    expect(wrapper.find('.fixed.inset-x-0.bottom-0').exists()).toBe(true)
  })
})
