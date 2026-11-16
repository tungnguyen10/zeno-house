import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import RequestsPage from '~/pages/portal/requests.vue'

const page = readFileSync(resolve('app/pages/portal/requests.vue'), 'utf8')

describe('portal requests refreshed UI', () => {
  it('uses the shared page rhythm, list status badge, and card skeletons', () => {
    expect(page).toContain('px-4 py-5 lg:px-8 lg:py-8')
    expect(page).toContain('<PortalStatusBadge :status="request.status" />')
    expect(page).toContain('variant="card"')
    expect(page).toContain('portal-type-heading')
    expect(page).toContain('portal-type-caption')
  })

  it('routes text and multiline fields through the shared Ui* form primitives with unified errors', () => {
    expect(page.match(/<UiInput/g)).toHaveLength(1)
    expect(page.match(/<UiTextarea/g)).toHaveLength(1)
    expect(page).not.toContain('<PortalTextField')
    expect(page).toContain(':error="formErrors.title"')
    expect(page).toContain(':error="formErrors.description"')
    expect(page.match(/<input/g)).toHaveLength(1)
    expect(page).toContain('type="file"')
  })

  it('gives the attachment field a visible focus and error relationship', () => {
    expect(page).toContain('focus-within:ring-2')
    expect(page).toContain(':aria-describedby="attachmentError ? \'request-attachment-error\' : undefined"')
    expect(page).toContain('id="request-attachment-error"')
  })
})

// Exercise the actual intent/create lifecycle; these mocks never call a business API.

const route = reactive({ query: {} as Record<string, unknown> })
const contract = ref<unknown>({ id: 'fixture-contract' })
const housingStatus = ref('success')
const submit = vi.fn(async () => false)
const apiError = ref<string | null>(null)
const toastSuccess = vi.fn()
const setChrome = vi.fn()
const fieldStub = { props: ['modelValue', 'label', 'error'], emits: ['update:modelValue'], template: '<label>{{label}}<input :data-label="label" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><span>{{error}}</span></label>' }
const stubs = {
  Teleport: true,
  IconPlus: true, IconMessageCircle: true, IconDocumentText: true, PortalSkeleton: true, PortalStatusBadge: true,
  PortalCard: { template: '<section><slot /></section>' },
  PortalPullToRefresh: { template: '<div><slot /></div>' },
  PortalButton: { props: ['loading', 'disabled', 'type'], template: '<button :type="type || \'button\'" :disabled="disabled || loading"><slot /></button>' },
  PortalEmptyState: { props: ['title', 'description'], template: '<section>{{title}} {{description}}</section>' },
  UiInput: fieldStub, UiTextarea: fieldStub,
}
beforeEach(() => {
  vi.clearAllMocks()
  route.query = {}
  contract.value = { id: 'fixture-contract' }
  housingStatus.value = 'success'
  apiError.value = null
  submit.mockResolvedValue(false)
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('usePortalChrome', () => ({ setChrome }))
  vi.stubGlobal('usePortalToast', () => ({ success: toastSuccess, error: vi.fn() }))
  vi.stubGlobal('usePortalContract', () => ({ contract, status: housingStatus, error: ref(null), refresh: vi.fn() }))
  vi.stubGlobal('usePortalRequests', () => ({ requests: ref([]), status: ref('success'), error: ref(null), refresh: vi.fn(), submit, submitting: ref(false), apiError }))
})

describe('profile correction request intent', () => {
  it('opens creation with a fixed title while ignoring supplied identity query values', async () => {
    route.query = { intent: 'profile-correction', full_name: 'Do not copy', id_number: 'PRIVATE' }
    const wrapper = mount(RequestsPage, { global: { stubs } })
    expect((wrapper.get('[data-label="Tiêu đề"]').element as HTMLInputElement).value).toBe('Yêu cầu chỉnh sửa hồ sơ')
    expect(wrapper.text()).toContain('Thông tin hồ sơ chỉ thay đổi sau khi ban quản lý đối chiếu và cập nhật.')
    expect(wrapper.text()).toContain('một tệp PDF')
    expect(wrapper.html()).not.toContain('PRIVATE')
    await wrapper.get('[data-label="Mô tả"]').setValue('Nội dung giả lập')
    route.query = { intent: 'profile-correction', id_number: 'ANOTHER' }
    await nextTick()
    expect((wrapper.get('[data-label="Mô tả"]').element as HTMLInputElement).value).toBe('Nội dung giả lập')
    expect(submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('keeps rejected correction text in memory and shows the server message', async () => {
    route.query = { intent: 'profile-correction' }
    submit.mockImplementationOnce(async () => { apiError.value = 'Không gửi được yêu cầu giả lập'; return false })
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('[data-label="Mô tả"]').setValue('Sửa thông tin giả lập')
    await wrapper.get('form').trigger('submit')
    expect(submit).toHaveBeenCalledWith({ title: 'Yêu cầu chỉnh sửa hồ sơ', description: 'Sửa thông tin giả lập', attachment: undefined })
    expect(wrapper.text()).toContain('Không gửi được yêu cầu giả lập')
    expect((wrapper.get('[data-label="Mô tả"]').element as HTMLInputElement).value).toBe('Sửa thông tin giả lập')
    expect(toastSuccess).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('confirms submission without claiming the profile changed', async () => {
    route.query = { intent: 'profile-correction' }
    submit.mockResolvedValue(true)
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('[data-label="Mô tả"]').setValue('Nội dung giả lập')
    await wrapper.get('form').trigger('submit')
    expect(toastSuccess).toHaveBeenCalledWith('Đã gửi yêu cầu, thông tin hồ sơ chưa thay đổi')
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not offer an unroutable correction form without active housing', () => {
    route.query = { intent: 'profile-correction' }
    contract.value = null
    const wrapper = mount(RequestsPage, { global: { stubs } })
    expect(wrapper.text()).toContain('Hồ sơ chưa có nơi tiếp nhận yêu cầu. Vui lòng liên hệ trực tiếp ban quản lý')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
