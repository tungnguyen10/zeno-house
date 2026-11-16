import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BasicsStep from '~/components/buildings/settings/steps/BasicsStep.vue'
import type { Building } from '~/types/buildings'

const submitUpdate = vi.fn()
const isDirty = ref(false)
let captured: { onUpdated?: (b: Building) => void, draftKey?: unknown } = {}

vi.stubGlobal('useBuildingForm', (options: typeof captured) => {
  captured = options
  return {
    isLoading: ref(false),
    errors: ref({}),
    apiError: ref<string | null>(null),
    submitUpdate,
    hasDraft: ref(false),
    restoreDraft: vi.fn(),
    clearDraft: vi.fn(),
    isDirty,
  }
})

const BuildingFormStub = defineComponent({
  props: ['modelValue', 'submitLabel'],
  emits: ['submit', 'cancel', 'update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', [
      h('span', { 'data-test': 'form-name' }, props.modelValue.name),
      h('span', { 'data-test': 'form-label' }, props.submitLabel),
      h('button', { 'data-test': 'submit', onClick: () => emit('submit', props.modelValue) }),
      h('button', { 'data-test': 'cancel', onClick: () => emit('cancel') }),
    ])
  },
})

const building = {
  id: 'b-1', name: 'Tòa A', address: '1 Lê Lợi', description: null, status: 'active',
  ownerName: null, ownerPhone: null, ownerEmail: null,
  electricityPricingType: 'per_kwh', defaultElectricityRate: 3500,
  waterPricingType: 'per_m3', defaultWaterRate: 15000,
  meterReadingDay: 28, billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 3,
  operationalStartYear: 2026, operationalStartMonth: 6,
} as unknown as Building

const mountStep = (b: Building = building) => mount(BasicsStep, {
  props: { building: b },
  global: {
    stubs: { BuildingForm: BuildingFormStub, UiAlert: defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } }) },
  },
})

beforeEach(() => {
  submitUpdate.mockReset()
  isDirty.value = false
})

describe('BasicsStep', () => {
  it('seeds the form from the building and keys the draft by building id', () => {
    const w = mountStep()

    expect(w.get('[data-test="form-name"]').text()).toBe('Tòa A')
    expect(captured.draftKey).toEqual({ mode: 'edit', id: 'b-1' })
  })

  it('submits the mapped payload for this building', async () => {
    const w = mountStep()
    await w.get('[data-test="submit"]').trigger('click')

    expect(submitUpdate).toHaveBeenCalledWith('b-1', expect.objectContaining({
      name: 'Tòa A', default_electricity_rate: 3500, payment_due_day: 5,
    }))
  })

  it('emits saved instead of navigating when the update succeeds', () => {
    const w = mountStep()
    captured.onUpdated!(building)

    expect(w.emitted('saved')![0]).toEqual([building])
  })

  it('reports dirty state to the page', async () => {
    const w = mountStep()
    expect(w.emitted('update:dirty')![0]).toEqual([false])

    isDirty.value = true
    await nextTick()
    expect(w.emitted('update:dirty')!.at(-1)).toEqual([true])
  })

  it('forwards cancel', async () => {
    const w = mountStep()
    await w.get('[data-test="cancel"]').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('does not overwrite edits in progress when the building refreshes', async () => {
    const w = mountStep()
    isDirty.value = true
    await w.setProps({ building: { ...building, name: 'Tên từ server' } as Building })
    expect(w.get('[data-test="form-name"]').text()).toBe('Tòa A')

    isDirty.value = false
    await w.setProps({ building: { ...building, name: 'Tên mới' } as Building })
    expect(w.get('[data-test="form-name"]').text()).toBe('Tên mới')
  })
})
