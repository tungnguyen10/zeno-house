import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'
import CreatePage from '~/pages/dashboard/buildings/create.vue'

const submitCreate = vi.fn()
let preview: ReturnType<typeof useQuickRoomPreview>

const BuildingFormStub = defineComponent({
  props: { modelValue: { type: Object, default: () => ({}) } },
  emits: ['submit'],
  setup: (props, { emit, slots }) => () => h('div', [
    h('button', { 'data-test': 'submit', onClick: () => emit('submit', props.modelValue) }),
    slots.extras?.(),
  ]),
})
const passthrough = (tag: string) => defineComponent({ setup: (_p, { slots }) => () => h(tag, slots.default?.()) })

function mountPage() {
  return mount(CreatePage, {
    global: {
      stubs: {
        BuildingForm: BuildingFormStub,
        RoomBatchGenerator: true,
        UiPageHeader: true,
        UiFormSection: passthrough('section'),
        UiAlert: passthrough('aside'),
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('useQuickRoomPreview', (options: Parameters<typeof useQuickRoomPreview>[0]) => (preview = useQuickRoomPreview(options)))
  vi.stubGlobal('useBuildingForm', () => ({
    isLoading: ref(false),
    errors: ref({}),
    apiError: ref(''),
    submitCreate,
    duplicateRoomNumbers: ref([]),
    hasDraft: ref(false),
    restoreDraft: vi.fn(),
    clearDraft: vi.fn(),
    isDirty: ref(false),
  }))
})

describe('building create page room generator guard', () => {
  it('blocks submit and shows the error while the generator is invalid', async () => {
    const w = mountPage()
    preview.generator.value.roomsPerFloor = Number.NaN
    await nextTick()

    await w.get('[data-test="submit"]').trigger('click')

    expect(submitCreate).not.toHaveBeenCalled()
    expect(w.text()).toContain('Sửa lỗi tạo phòng nhanh trước khi tạo tòa nhà.')
  })

  it('clears the blocking message once the generator is valid again', async () => {
    const w = mountPage()
    preview.generator.value.roomsPerFloor = Number.NaN
    await nextTick()
    await w.get('[data-test="submit"]').trigger('click')

    preview.generator.value.roomsPerFloor = 0
    await nextTick()

    expect(w.text()).not.toContain('Sửa lỗi tạo phòng nhanh')
    await w.get('[data-test="submit"]').trigger('click')
    expect(submitCreate).toHaveBeenCalledTimes(1)
  })

  it('still creates a building with no rooms when the generator is empty but valid', async () => {
    const w = mountPage()
    await w.get('[data-test="submit"]').trigger('click')

    expect(submitCreate).toHaveBeenCalledTimes(1)
    expect(submitCreate.mock.calls[0]![0].rooms).toBeUndefined()
  })
})
