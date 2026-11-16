import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IdentitySuggestion } from '~/utils/validators/tenant-identity-extraction'
import TenantIdentityScanner from '~/components/tenants/TenantIdentityScanner.vue'

const extractMock = vi.hoisted(() => vi.fn())
const abortMock = vi.hoisted(() => vi.fn())
const errorRef = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('~/composables/tenants/useTenantIdentityExtract', () => ({
  useTenantIdentityExtract: () => ({
    extract: extractMock,
    abort: abortMock,
    loading: ref(false),
    get error() { return ref(errorRef.value) },
  }),
}))

const config = { public: { aiTenantVisionEnabled: true } }
const auth = { can: (_capability: string) => true }
vi.stubGlobal('useRuntimeConfig', () => config)
vi.stubGlobal('useAuthStore', () => auth)

const createUrl = vi.fn((file: File) => `blob:${file.name}`)
const revokeUrl = vi.fn()
vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }))

const alertStub = defineComponent({ template: '<div role="alert"><slot /></div>' })
const buttonStub = defineComponent({
  props: ['disabled', 'loading'],
  emits: ['click'],
  template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
})
const badgeStub = defineComponent({ template: '<span><slot /></span>' })

const TARGETS = ['full_name', 'id_number', 'date_of_birth', 'gender', 'id_issued_date', 'id_issued_place', 'permanent_address']

function suggestion(overrides: Partial<IdentitySuggestion> = {}, fields: Partial<IdentitySuggestion['fields']> = {}): IdentitySuggestion {
  return {
    document_type: 'can_cuoc_2024',
    capture_layout: 'separate_images',
    fields: {
      full_name: 'NGUYỄN VĂN MẪU',
      id_number: '001099000000',
      date_of_birth: '1999-01-31',
      gender: 'male',
      nationality: null,
      residence_address: 'Phường Mẫu, Hà Nội',
      address_label: 'noi_thuong_tru',
      birth_registration_place: null,
      place_of_origin: null,
      id_issued_date: null,
      id_expiry_date: null,
      id_issued_place: null,
      ...fields,
    },
    warnings: [],
    identity_mismatch: false,
    needs_review: true,
    apply: { permanent_address_allowed: true },
    ...overrides,
  }
}

const image = (name: string, type = 'image/jpeg', size = 1000) => new File([new Uint8Array(size)], name, { type })

function mountScanner(props: Record<string, unknown> = {}) {
  return mount(TenantIdentityScanner, {
    props: { currentValues: {}, fields: TARGETS, ...props },
    global: { stubs: { UiButton: buttonStub, UiAlert: alertStub, UiBadge: badgeStub } },
    attachTo: document.body,
  })
}

async function selectFiles(wrapper: ReturnType<typeof mountScanner>, files: File[], input = 'scanner-file-input') {
  const element = wrapper.find(`[data-test="${input}"]`).element as HTMLInputElement
  Object.defineProperty(element, 'files', { value: files, configurable: true })
  await wrapper.find(`[data-test="${input}"]`).trigger('change')
}

beforeEach(() => {
  vi.clearAllMocks()
  config.public.aiTenantVisionEnabled = true
  auth.can = () => true
  errorRef.value = null
})

describe('TenantIdentityScanner visibility', () => {
  it('is hidden when the public flag is off', () => {
    config.public.aiTenantVisionEnabled = false
    expect(mountScanner().find('[data-test="identity-scanner"]').exists()).toBe(false)
  })

  it('is hidden without tenant create or update capability', () => {
    auth.can = () => false
    expect(mountScanner().find('[data-test="identity-scanner"]').exists()).toBe(false)
  })

  it('is shown when enabled and permitted', () => {
    expect(mountScanner().find('[data-test="identity-scanner"]').exists()).toBe(true)
  })
})

describe('TenantIdentityScanner images', () => {
  it('shows a preview, enables reading and revokes the url on remove', async () => {
    const wrapper = mountScanner()
    expect(wrapper.find('[data-test="scanner-extract"]').attributes('disabled')).toBeDefined()
    await selectFiles(wrapper, [image('front.jpg')])
    expect(wrapper.findAll('[data-test="scanner-preview"]')).toHaveLength(1)
    expect(wrapper.find('[data-test="scanner-extract"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('[data-test="scanner-remove-0"]').trigger('click')
    expect(revokeUrl).toHaveBeenCalledWith('blob:front.jpg')
    expect(wrapper.findAll('[data-test="scanner-preview"]')).toHaveLength(0)
  })

  it('accepts at most two images', async () => {
    const wrapper = mountScanner()
    await selectFiles(wrapper, [image('a.jpg'), image('b.jpg'), image('c.jpg')])
    expect(wrapper.findAll('[data-test="scanner-preview"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="scanner-local-error"]').text()).toContain('tối đa 2')
  })

  it('rejects unsupported types and files over 5 MB', async () => {
    const wrapper = mountScanner()
    await selectFiles(wrapper, [image('doc.pdf', 'application/pdf'), image('big.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)])
    expect(wrapper.findAll('[data-test="scanner-preview"]')).toHaveLength(0)
    expect(wrapper.find('[data-test="scanner-local-error"]').exists()).toBe(true)
  })

  it('offers a camera input that prefers the rear camera', () => {
    const camera = mountScanner().find('[data-test="scanner-camera-input"]')
    expect(camera.attributes('capture')).toBe('environment')
    expect(camera.attributes('accept')).toBe('image/jpeg,image/png,image/webp')
  })

  it('revokes urls and aborts on unmount', async () => {
    const wrapper = mountScanner()
    await selectFiles(wrapper, [image('front.jpg')])
    wrapper.unmount()
    expect(revokeUrl).toHaveBeenCalledWith('blob:front.jpg')
    expect(abortMock).toHaveBeenCalled()
  })

  it('never uses browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    extractMock.mockResolvedValue(suggestion())
    const wrapper = mountScanner()
    await selectFiles(wrapper, [image('front.jpg')])
    await wrapper.find('[data-test="scanner-extract"]').trigger('click')
    await flushPromises()
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })
})

describe('TenantIdentityScanner suggestions', () => {
  async function readWith(result: IdentitySuggestion, props: Record<string, unknown> = {}) {
    extractMock.mockResolvedValue(result)
    const wrapper = mountScanner(props)
    await selectFiles(wrapper, [image('front.jpg')])
    await wrapper.find('[data-test="scanner-extract"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('sends the selected files to the extractor', async () => {
    const wrapper = await readWith(suggestion())
    expect(extractMock).toHaveBeenCalledWith([expect.any(File)])
    expect(wrapper.find('[data-test="scanner-row-full_name"]').text()).toContain('NGUYỄN VĂN MẪU')
    expect(wrapper.find('[data-test="scanner-row-date_of_birth"]').text()).toContain('31/01/1999')
  })

  it('applies a single field only', async () => {
    const wrapper = await readWith(suggestion())
    await wrapper.find('[data-test="scanner-apply-id_number"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[{ id_number: '001099000000' }]])
  })

  it('applies all empty fields but skips ones the user typed', async () => {
    const wrapper = await readWith(suggestion(), { currentValues: { full_name: 'Tên tôi gõ' } })
    expect(wrapper.find('[data-test="scanner-apply-full_name"]').attributes('disabled')).toBeDefined()
    await wrapper.find('[data-test="scanner-apply-empty"]').trigger('click')
    const [payload] = wrapper.emitted('apply')![0] as [Record<string, string>]
    expect(payload).toMatchObject({ id_number: '001099000000', date_of_birth: '1999-01-31', gender: 'male', permanent_address: 'Phường Mẫu, Hà Nội' })
    expect(payload).not.toHaveProperty('full_name')
  })

  it('does not offer the permanent address when the label is residence', async () => {
    const wrapper = await readWith(suggestion({ apply: { permanent_address_allowed: false } }, { address_label: 'noi_cu_tru' }))
    expect(wrapper.find('[data-test="scanner-apply-permanent_address"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="scanner-row-permanent_address"]').text()).toContain('Nơi cư trú')
    await wrapper.find('[data-test="scanner-apply-empty"]').trigger('click')
    expect(wrapper.emitted('apply')![0]![0]).not.toHaveProperty('permanent_address')
  })

  it('blocks everything when the images do not match', async () => {
    const wrapper = await readWith(suggestion({ identity_mismatch: true }))
    expect(wrapper.find('[data-test="scanner-mismatch"]').text()).toContain('không khớp')
    for (const button of wrapper.findAll('[data-test^="scanner-apply-"]')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
    await wrapper.find('[data-test="scanner-apply-id_number"]').trigger('click')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('never applies anything without a click', async () => {
    const wrapper = await readWith(suggestion())
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('shows extractor errors and keeps manual entry available', async () => {
    errorRef.value = 'Đã hết lượt đọc ảnh hôm nay. Vui lòng nhập tay.'
    extractMock.mockResolvedValue(null)
    const wrapper = mountScanner()
    await selectFiles(wrapper, [image('front.jpg')])
    await wrapper.find('[data-test="scanner-extract"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="scanner-error"]').text()).toContain('Vui lòng nhập tay')
  })

  it('warns about unreadable fields reported by the model', async () => {
    const wrapper = await readWith(suggestion({ warnings: ['Ngày cấp không đọc được'] }))
    expect(wrapper.find('[data-test="scanner-warnings"]').text()).toContain('Ngày cấp không đọc được')
  })
})
