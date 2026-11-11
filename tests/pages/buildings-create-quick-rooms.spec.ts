import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, beforeEach, vi  } from 'vitest'

// Render real preview controls and composable; isolate only the surrounding building form/API.
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import CreatePage from '~/pages/dashboard/buildings/create.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiTable from '~/components/ui/UiTable.vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import QuickRoomCellEditor from '~/components/buildings/QuickRoomCellEditor.vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/create.vue'), 'utf8')

describe('building create quick rooms', () => {
  it('uses the persistent preview composable', () => {
    expect(page).toContain('useQuickRoomPreview()')
    expect(page).not.toContain('const previewRooms = computed')
    expect(page).not.toContain('updatePreviewRent')
  })
  it('exposes editable floor and area cells', () => {
    expect(page).toContain("key: 'floor'")
    expect(page).toContain('#cell-floor')
    expect(page).toContain("setCell(row.roomNumber, 'area'")
    expect(page).toContain("setCell(row.roomNumber, 'floor'")
  })
  it('offers default floor and bounded count', () => {
    expect(page).toContain('label="Tầng mặc định"')
    expect(page).toContain('QUICK_ROOM_MAX')
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
  it('provides accessible override resets, loading locks and mobile containment', () => {
    for (const field of ['floor', 'rent', 'area']) {
      expect(page).toContain(`preview.resetCell(row.roomNumber, '${field}')`)
      expect(page).toContain(`row.overridden.includes('${field}')`)
    }
    expect(page).toContain(':disabled="isLoading"')
    expect(page).toContain('overflow-x-auto')
    expect(page).toContain('aria-label="Xem trước phòng"')
    expect(page).toContain('min-w-0')
    expect(page).toContain("useMediaQuery('(min-width: 640px)')")
    expect(page).toContain('data-test="quick-room-list"')
  })
})

const wide = vi.hoisted(() => ({ value: true }))
vi.mock('@vueuse/core', async (importOriginal) => {
  const { ref: vueRef } = await import('vue')
  return { ...(await importOriginal<typeof import('@vueuse/core')>()), useMediaQuery: () => vueRef(wide.value) }
})

const loading = ref(false)
const fieldErrors = ref<Record<string, string[]>>({})
const serverDuplicates = ref<string[]>([])
const submit = vi.fn()

beforeEach(() => {
  wide.value = true
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
    components: { UiInput, UiTable, UiAlert, QuickRoomCellEditor },
    stubs: {
      UiPageHeader: true,
      BuildingForm: { props: ['modelValue'], emits: ['submit'], template: '<form @submit.prevent="$emit(\'submit\', modelValue)"><slot name="extras" /></form>' },
    },
  } })
}

describe('building preview interactions', () => {
  it('preserves edits on default changes, resets overrides and submits edited rooms', async () => {
    const wrapper = renderPage()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('[aria-label="Tầng phòng P101"]').setValue('4')
    await wrapper.get('[aria-label="Diện tích phòng P101"]').setValue('23.5')
    const defaultFloor = wrapper.findAllComponents(UiInput).find(input => input.props('label') === 'Tầng mặc định')!
    await defaultFloor.get('input').setValue('2')
    expect((wrapper.get('[aria-label="Tầng phòng P101"]').element as HTMLInputElement).value).toBe('4')
    expect((wrapper.get('[aria-label="Tầng phòng P102"]').element as HTMLInputElement).value).toBe('2')
    await wrapper.get('[aria-label="Khôi phục tầng mặc định cho phòng P101"]').trigger('click')
    expect((wrapper.get('[aria-label="Tầng phòng P101"]').element as HTMLInputElement).value).toBe('2')
    await wrapper.get('form').trigger('submit')
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ rooms: expect.arrayContaining([
      expect.objectContaining({ room_number: 'P101', floor: 2, area: 23.5 }),
    ]) }))
    wrapper.unmount()
  })

  it('resets rent edits when same-price is enabled', async () => {
    const wrapper = renderPage()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    const samePrice = wrapper.findAll('input[type="checkbox"]')[1]!
    await samePrice.setValue(false)
    await wrapper.get('[aria-label="Giá thuê phòng P101"]').setValue('1500000')
    expect(wrapper.find('[aria-label="Khôi phục giá thuê mặc định cho phòng P101"]').exists()).toBe(true)
    await samePrice.setValue(true)
    await samePrice.setValue(false)
    expect((wrapper.get('[aria-label="Giá thuê phòng P101"]').element as HTMLInputElement).value).toBe('0')
    expect(wrapper.find('[aria-label="Khôi phục giá thuê mặc định cho phòng P101"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows room validation and server duplicates and locks controls in flight', async () => {
    const wrapper = renderPage()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    fieldErrors.value = { rooms: ['Diện tích phải lớn hơn 0'] }
    serverDuplicates.value = ['P102']
    await nextTick()
    expect(wrapper.text()).toContain('Diện tích phải lớn hơn 0')
    expect(wrapper.text()).toContain('Các mã phòng bị trùng: P102')
    expect(wrapper.findAll('tbody tr')[1]!.text()).toContain('Mã trùng')
    loading.value = true
    await nextTick()
    expect(wrapper.findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders a compact list without a wide table on narrow screens', async () => {
    wide.value = false
    const wrapper = renderPage()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="quick-room-row"]')).toHaveLength(3)
    await wrapper.get('[aria-label="Tầng phòng P101"]').setValue('3')
    const reset = wrapper.get('[aria-label="Khôi phục tầng mặc định cho phòng P101"]')
    await reset.trigger('click')
    expect((wrapper.get('[aria-label="Tầng phòng P101"]').element as HTMLInputElement).value).toBe('1')
    serverDuplicates.value = ['P102']
    await nextTick()
    expect(wrapper.findAll('[data-test="quick-room-row"]')[1]!.text()).toContain('Mã trùng')
    wrapper.unmount()
  })
})
