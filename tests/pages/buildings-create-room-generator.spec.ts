import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeEach, vi } from 'vitest'

// Render real generator/preview controls and composable; isolate only the surrounding building form/API.
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import CreatePage from '~/pages/dashboard/buildings/create.vue'
import RoomBatchGenerator from '~/components/rooms/RoomBatchGenerator.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import QuickRoomCellEditor from '~/components/buildings/QuickRoomCellEditor.vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/create.vue'), 'utf8')
const icon = defineComponent({ template: '<span />' })

describe('building create quick rooms', () => {
  it('uses the persistent preview composable and the shared generator', () => {
    expect(page).toContain('useQuickRoomPreview()')
    expect(page).toContain('<RoomBatchGenerator')
    expect(page).not.toContain('const previewRooms = computed')
  })
  it('highlights duplicates and submits the atomic rooms payload', () => {
    expect(page).toContain('duplicateRoomNumbers')
    expect(page).toContain('markServerDuplicates')
    expect(page).toContain('preview.toPayload()')
    expect(page).not.toContain('quickRooms:')
  })
  it('renders flattened room validation errors next to the preview', () => {
    expect(page).toContain('v-if="errors.rooms?.length"')
    expect(page).toContain("errors.rooms.join(' ')")
  })
  it('locks generator controls while submitting', () => {
    expect(page).toContain(':disabled="isLoading"')
  })
})

const loading = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})
const serverDuplicates = ref<string[]>([])
const submit = vi.fn()

beforeEach(() => {
  loading.value = false
  fieldErrors.value = {}
  serverDuplicates.value = []
  submit.mockReset()
  vi.stubGlobal('useQuickRoomPreview', useQuickRoomPreview)
  vi.stubGlobal('useBuildingForm', () => ({
    isLoading: loading, errors: fieldErrors, apiError: ref(null), submitCreate: submit,
    duplicateRoomNumbers: serverDuplicates, hasDraft: ref(false), isDirty: ref(false),
    restoreDraft: vi.fn(), clearDraft: vi.fn(),
  }))
})

function renderPage() {
  return mount(CreatePage, { global: {
    components: { RoomBatchGenerator, UiInput, UiBadge, UiAlert, UiCheckbox, QuickRoomCellEditor, IconX: icon, IconPlus: icon, IconRefresh: icon },
    stubs: {
      UiPageHeader: true,
      BuildingForm: { props: ['modelValue'], emits: ['submit'], template: '<form @submit.prevent="$emit(\'submit\', modelValue)"><slot name="extras" /></form>' },
    },
  } })
}

const checkbox = (wrapper: ReturnType<typeof renderPage>, text: string) =>
  wrapper.findAllComponents(UiCheckbox).find(c => String(c.props('label')).includes(text))!

describe('building preview interactions', () => {
  it('preserves edits, resets overrides and submits edited rooms', async () => {
    const wrapper = renderPage()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('[aria-label="Tầng phòng P01"]').setValue('4')
    await wrapper.get('[aria-label="Diện tích phòng P01"]').setValue('23.5')
    expect((wrapper.get('[aria-label="Tầng phòng P01"]').element as HTMLInputElement).value).toBe('4')
    await wrapper.get('[aria-label="Khôi phục tầng mặc định cho phòng P01"]').trigger('click')
    expect((wrapper.get('[aria-label="Tầng phòng P01"]').element as HTMLInputElement).value).toBe('1')
    await wrapper.get('form').trigger('submit')
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ rooms: expect.arrayContaining([
      expect.objectContaining({ room_number: 'P01', floor: 1, area: 23.5 }),
    ]) }))
    wrapper.unmount()
  })

  it('resets rent edits when same-price is enabled', async () => {
    const wrapper = renderPage()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    const samePrice = checkbox(wrapper, 'Đồng giá')
    await samePrice.get('input').setValue(false)
    await wrapper.get('[aria-label="Giá thuê phòng P01"]').setValue('1500000')
    expect(wrapper.find('[aria-label="Khôi phục giá thuê mặc định cho phòng P01"]').exists()).toBe(true)
    await samePrice.get('input').setValue(true)
    await samePrice.get('input').setValue(false)
    expect((wrapper.get('[aria-label="Giá thuê phòng P01"]').element as HTMLInputElement).value).toBe('0')
    expect(wrapper.find('[aria-label="Khôi phục giá thuê mặc định cho phòng P01"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows room validation and server duplicates and locks controls in flight', async () => {
    const wrapper = renderPage()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    fieldErrors.value = { rooms: ['Diện tích phải lớn hơn 0'] }
    serverDuplicates.value = ['P02']
    await nextTick()
    expect(wrapper.text()).toContain('Diện tích phải lớn hơn 0')
    expect(wrapper.text()).toContain('Các mã phòng bị trùng: P02')
    expect(wrapper.get('[data-test="room-row-P02"]').text()).toContain('Mã trùng')
    loading.value = true
    await nextTick()
    expect(wrapper.findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
