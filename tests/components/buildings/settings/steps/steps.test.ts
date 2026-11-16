import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContractStep from '~/components/buildings/settings/steps/ContractStep.vue'
import InventoryStep from '~/components/buildings/settings/steps/InventoryStep.vue'
import { provideBuildingSettingsSource, useBuildingSettingsSource, type BuildingSettingsSource } from '~/composables/buildings/useBuildingSettingsSource'

const toast = { success: vi.fn(), error: vi.fn() }
let allowed: string[] = []
vi.stubGlobal('useToast', () => toast)
vi.stubGlobal('useBuildingSettingsSource', useBuildingSettingsSource)
vi.stubGlobal('useAuthStore', () => ({ can: (capability: string) => allowed.includes(capability) }))

const building = { id: 'b-1', slug: 'qa-v2-flow', code: 'qav2' }
const profile = { lessorFullName: 'Nguyen Van QA' }

function makeSource(): BuildingSettingsSource {
  const data = ref({ data: { building, contractProfile: profile } })
  const settings = computed(() => data.value.data) as unknown as BuildingSettingsSource['settings']
  return {
    id: 'qa-v2-flow',
    settingsData: data as never,
    status: ref('success') as never,
    error: ref(undefined) as never,
    refresh: vi.fn(async () => {}) as never,
    settings,
    building: computed(() => building) as never,
    contractRows: computed(() => []) as never,
    assignedManagers: computed(() => []) as never,
  }
}

function withSource<T extends object>(component: T, props: Record<string, unknown> = {}, source = makeSource(), components: Record<string, object> = {}) {
  const onSaved = vi.fn()
  const wrapper = mount(defineComponent({
    setup() {
      provideBuildingSettingsSource(source)
      return () => h(component as never, { ...props, onSaved })
    },
  }), {
    global: {
      components: components as never,
      stubs: {
        UiSection: defineComponent({ setup(_, { slots }) { return () => h('section', [slots.actions?.(), slots.default?.()]) } }),
        UiSurfacePanel: defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } }),
        UiAlert: defineComponent({ setup(_, { slots }) { return () => h('div', { 'data-test': 'alert' }, slots.default?.()) } }),
        UiButton: defineComponent({
          emits: ['click'],
          setup(_, { slots, emit }) { return () => h('button', { onClick: () => emit('click') }, slots.default?.()) },
        }),
      },
    },
  })
  return { wrapper, onSaved, source }
}

beforeEach(() => {
  toast.success.mockReset()
  toast.error.mockReset()
  allowed = []
})

describe('ContractStep', () => {
  const save = vi.fn()
  let formProps: Record<string, unknown> = {}
  const ProfileStub = defineComponent({
    props: ['profile', 'building', 'canEdit', 'saving', 'error', 'editPath'],
    emits: ['save'],
    setup(props, { emit }) {
      formProps = props as Record<string, unknown>
      return () => h('button', { 'data-test': 'save', onClick: () => emit('save', { lessor_full_name: 'Moi' }) })
    },
  })

  beforeEach(() => {
    save.mockReset()
    formProps = {}
    vi.stubGlobal('useBuildingContractProfile', () => ({ saving: ref(false), error: ref(null), save }))
  })

  const mountStep = () => withSource(ContractStep, {}, makeSource(), { BuildingContractProfileSettings: ProfileStub })

  it('hands the profile, permission and settings edit path to the form', () => {
    allowed = ['building-contract-profile.write']
    mountStep()

    expect(formProps.profile).toEqual(profile)
    expect(formProps.canEdit).toBe(true)
    expect(formProps.editPath).toBe('/dashboard/buildings/qa-v2-flow/settings#basics')
  })

  it('is read-only without the write permission', () => {
    mountStep()

    expect(formProps.canEdit).toBe(false)
  })

  it('saves, shows a success toast and tells the page to close the step', async () => {
    save.mockResolvedValue(undefined)
    const { wrapper, onSaved } = mountStep()
    await wrapper.get('[data-test="save"]').trigger('click')
    await flushPromises()

    expect(save).toHaveBeenCalledWith({ lessor_full_name: 'Moi' })
    expect(toast.success).toHaveBeenCalledWith('Đã lưu thông tin hợp đồng của tòa nhà.')
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('keeps the step open and stays silent when saving fails', async () => {
    save.mockRejectedValue(new Error('boom'))
    const { wrapper, onSaved } = mountStep()
    await wrapper.get('[data-test="save"]').trigger('click')
    await flushPromises()

    expect(toast.success).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('InventoryStep', () => {
  const makeTemplate = () => {
    const items = ref([{ id: 'i-1', name: 'Giuong', quantity: 1, condition: 'good', unitValue: 1_500_000, note: null }])
    return {
      items,
      saving: ref(false),
      error: ref<string | null>(null),
      save: vi.fn(async () => {}),
      apply: vi.fn(async () => ({ addedItems: 4, appliedRooms: 2 })),
    }
  }
  const EditorStub = defineComponent({ props: ['modelValue', 'disabled'], setup(props) { return () => h('div', { 'data-test': 'editor', 'data-disabled': String(props.disabled) }, JSON.stringify(props.modelValue)) } })
  const ApplyStub = defineComponent({ props: ['open', 'buildingId'], emits: ['apply', 'close'], setup(props) { return () => h('div', { 'data-test': 'apply', 'data-open': String(props.open) }) } })

  const mountStep = (template = makeTemplate(), canEdit = true) => {
    const wrapper = mount(InventoryStep, {
      props: { template: template as never, buildingId: 'b-1', canEdit },
      global: {
        stubs: {
          UiSection: defineComponent({ setup(_, { slots }) { return () => h('section', [slots.actions?.(), slots.default?.()]) } }),
          UiSurfacePanel: defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } }),
          UiAlert: defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } }),
          UiButton: defineComponent({ emits: ['click'], setup(_, { slots, emit }) { return () => h('button', { onClick: () => emit('click') }, slots.default?.()) } }),
          InventoryItemsEditor: EditorStub,
          InventoryApplyModal: ApplyStub,
        },
      },
    })
    return { wrapper, template }
  }

  it('turns the template items into an editable draft', () => {
    const { wrapper } = mountStep()

    expect(wrapper.get('[data-test="editor"]').text()).toContain('"unit_value":1500000')
  })

  it('is read-only without edit permission and hides the save button', () => {
    const { wrapper } = mountStep(makeTemplate(), false)

    expect(wrapper.get('[data-test="editor"]').attributes('data-disabled')).toBe('true')
    expect(wrapper.text()).not.toContain('Lưu nội thất mẫu')
  })

  it('saves the draft, toasts and emits saved', async () => {
    const { wrapper, template } = mountStep()
    await wrapper.findAll('button').find(b => b.text() === 'Lưu nội thất mẫu')!.trigger('click')
    await Promise.resolve()

    expect(template.save).toHaveBeenCalledWith([{ name: 'Giuong', quantity: 1, condition: 'good', unit_value: 1_500_000, note: null }])
    expect(toast.success).toHaveBeenCalledWith('Đã lưu nội thất mẫu của tòa nhà.')
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('applies to rooms, closes the modal and reports the counts', async () => {
    const { wrapper, template } = mountStep()
    await wrapper.findAll('button').find(b => b.text().startsWith('Áp dụng cho phòng'))!.trigger('click')
    expect(wrapper.get('[data-test="apply"]').attributes('data-open')).toBe('true')

    await wrapper.findComponent(ApplyStub).vm.$emit('apply', { roomIds: ['r-1'] })
    await Promise.resolve()
    await Promise.resolve()

    expect(template.apply).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Đã thêm 4 món cho 2 phòng.')
    expect(wrapper.get('[data-test="apply"]').attributes('data-open')).toBe('false')
  })

  it('reports an apply failure without closing the modal', async () => {
    const template = makeTemplate()
    template.apply.mockRejectedValue(new Error('nope'))
    const { wrapper } = mountStep(template)
    await wrapper.findAll('button').find(b => b.text().startsWith('Áp dụng cho phòng'))!.trigger('click')

    await wrapper.findComponent(ApplyStub).vm.$emit('apply', {})
    await Promise.resolve()
    await Promise.resolve()

    expect(toast.error).toHaveBeenCalled()
    expect(wrapper.get('[data-test="apply"]').attributes('data-open')).toBe('true')
  })
})
