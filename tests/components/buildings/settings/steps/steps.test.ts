import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

beforeEach(() => {
  toast.success.mockReset()
  toast.error.mockReset()
  allowed = []
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

  const mountStep = (template = makeTemplate(), canEdit = true, pendingRoomIds: string[] = []) => {
    const source = makeSource()
    source.settingsData.value = { data: { building, roomIdsWithoutInventory: pendingRoomIds } } as never
    const wrapper = mount(defineComponent({
      setup() {
        provideBuildingSettingsSource(source)
        return () => h(InventoryStep, { template: template as never, buildingId: 'b-1', canEdit })
      },
    }), {
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
    return { wrapper, template, source }
  }

  const saveButton = (wrapper: ReturnType<typeof mountStep>['wrapper']) =>
    wrapper.findAll('button').find(b => b.text() === 'Lưu nội thất mẫu')!

  it('suggests applying the template to rooms without items only after saving', async () => {
    const { wrapper } = mountStep(makeTemplate(), true, ['r-1', 'r-2'])
    expect(wrapper.find('[data-test="inventory-apply-suggestion"]').exists()).toBe(false)

    await saveButton(wrapper).trigger('click')
    await flushPromises()

    const alert = wrapper.get('[data-test="inventory-apply-suggestion"]')
    expect(alert.text()).toContain('2 phòng chưa có nội thất')
    expect(wrapper.findComponent(InventoryStep).emitted('saved')).toHaveLength(1)
  })

  it('does not suggest anything when every room already has items', async () => {
    const { wrapper } = mountStep()
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="inventory-apply-suggestion"]').exists()).toBe(false)
  })

  it('applies the template to the pending rooms in merge mode, refreshes and hides the suggestion', async () => {
    const { wrapper, template, source } = mountStep(makeTemplate(), true, ['r-1', 'r-2'])
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === 'Áp dụng cho 2 phòng')!.trigger('click')
    await flushPromises()

    expect(template.apply).toHaveBeenCalledWith({ room_ids: ['r-1', 'r-2'], mode: 'merge' })
    expect(source.refresh).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Đã áp dụng nội thất mẫu.')
    expect(wrapper.find('[data-test="inventory-apply-suggestion"]').exists()).toBe(false)
  })

  it('sends at most 200 rooms per request and keeps the suggestion for the rest', async () => {
    const pending = Array.from({ length: 250 }, (_, i) => `r-${i}`)
    const { wrapper, template, source } = mountStep(makeTemplate(), true, pending)
    source.refresh = vi.fn(async () => {
      source.settingsData.value = { data: { building, roomIdsWithoutInventory: pending.slice(200) } } as never
    }) as never
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === 'Áp dụng cho 250 phòng')!.trigger('click')
    await flushPromises()

    const call = (template.apply.mock.calls[0] as unknown as [{ room_ids: string[] }])[0]
    expect(call.room_ids).toHaveLength(200)
    expect(wrapper.get('[data-test="inventory-apply-suggestion"]').text()).toContain('50 phòng chưa có nội thất')
  })

  it('reports an apply failure and keeps the suggestion', async () => {
    const template = makeTemplate()
    template.apply.mockRejectedValue(new Error('nope'))
    const { wrapper } = mountStep(template, true, ['r-1'])
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === 'Áp dụng cho 1 phòng')!.trigger('click')
    await flushPromises()

    expect(toast.error).toHaveBeenCalled()
    expect(wrapper.find('[data-test="inventory-apply-suggestion"]').exists()).toBe(true)
  })

  it('hides the apply suggestion again when a later save fails', async () => {
    const template = makeTemplate()
    const { wrapper } = mountStep(template, true, ['r-1'])
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="inventory-apply-suggestion"]').exists()).toBe(true)

    template.save.mockRejectedValueOnce(new Error('nope'))
    await saveButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="inventory-apply-suggestion"]').exists()).toBe(false)
  })

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
    expect(wrapper.findComponent(InventoryStep).emitted('saved')).toHaveLength(1)
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
