import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import RequestsPage from '~/pages/portal/requests.vue'
import { usePortalUnsavedChanges } from '~/composables/tenant-portal/usePortalUnsavedChanges'
import type { TenantSupportRequest } from '~/types/tenant-portal'

const page = readFileSync(resolve('app/pages/portal/requests.vue'), 'utf8')

describe('portal requests refreshed UI', () => {
  it('uses the shared page rhythm, list status badge, and card skeletons', () => {
    expect(page).toContain('px-4 py-5 lg:px-8 lg:py-8')
    expect(page).toContain('<PortalStatusBadge :status="request.status" />')
    expect(page).toContain('variant="card"')
    expect(page).toContain('portal-type-heading')
    expect(page).toContain('portal-type-caption')
  })

  it('uses portal text controls for readable mobile form text and unified errors', () => {
    expect(page.match(/<PortalInput/g)).toHaveLength(2)
    expect(page).toContain('textarea')
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
const requests = ref<TenantSupportRequest[]>([])
const loadDetail = vi.fn()
const submitting = ref(false)
const progress = ref(0)
const hasMore = ref(false)
const loadMore = vi.fn()
const loadMoreError = ref<string | null>(null)
const sessionKey = ref('portal-tenant-a-requests')
const fieldStub = { props: ['modelValue', 'label', 'error', 'readonly', 'disabled', 'maxlength'], emits: ['update:modelValue'], template: '<label>{{label}}<input :data-label="label" :value="modelValue" :readonly="readonly" :disabled="disabled" :maxlength="maxlength" @input="$emit(\'update:modelValue\', $event.target.value)" /><span>{{error}}</span></label>' }
const stubs = {
  Teleport: true,
  IconPlus: true, IconMessageCircle: true, IconDocumentText: true, IconChevronRight: true, PortalSkeleton: true, PortalStatusBadge: true,
  PortalCard: { template: '<section><slot /></section>' },
  PortalBottomSheet: { props: ['modelValue', 'title'], template: '<section v-if="modelValue" role="dialog" :aria-label="title"><h2>{{title}}</h2><slot /></section>' },
  PortalPullToRefresh: { template: '<div><slot /></div>' },
  PortalButton: { props: ['loading', 'disabled', 'type'], template: '<button :type="type || \'button\'" :disabled="disabled || loading"><slot /></button>' },
  PortalEmptyState: { props: ['title', 'description'], template: '<section>{{title}} {{description}}</section>' },
  PortalInput: fieldStub,
}
beforeEach(() => {
  vi.clearAllMocks()
  route.query = {}
  contract.value = { id: 'fixture-contract' }
  housingStatus.value = 'success'
  apiError.value = null
  submit.mockResolvedValue(false)
  requests.value = []
  loadDetail.mockResolvedValue(null)
  submitting.value = false
  progress.value = 0
  hasMore.value = false
  loadMoreError.value = null
  sessionKey.value = 'portal-tenant-a-requests'
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('usePortalChrome', () => ({ setChrome }))
  vi.stubGlobal('usePortalToast', () => ({ success: toastSuccess, error: vi.fn() }))
  vi.stubGlobal('usePortalUnsavedChanges', usePortalUnsavedChanges)
  vi.stubGlobal('onBeforeRouteLeave', vi.fn())
  vi.stubGlobal('usePortalContract', () => ({ contract, status: housingStatus, error: ref(null), refresh: vi.fn() }))
  vi.stubGlobal('usePortalRequests', () => ({ sessionKey, requests, status: ref('success'), error: ref(null), refresh: vi.fn(), loadMore, hasMore, loadingMore: ref(false), loadMoreError, loadDetail, submit, submitting, progress, apiError }))
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

  it('keeps the typed request form mounted while housing refreshes and blocks submission until resolved', async () => {
    route.query = { intent: 'profile-correction' }
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('[data-label="Mô tả"]').setValue('Draft after selecting an attachment')
    const input = wrapper.get('[data-label="Mô tả"]').element
    housingStatus.value = 'pending'
    await nextTick()
    expect(wrapper.get('[data-label="Mô tả"]').element).toBe(input)
    expect((input as HTMLInputElement).value).toBe('Draft after selecting an attachment')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(submit).not.toHaveBeenCalled()
    housingStatus.value = 'success'
    await nextTick()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
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

describe('support detail and safe draft workflow', () => {
  const request: TenantSupportRequest = {
    id: 'request-1', tenantId: 'tenant-1', buildingId: 'building-1', contractId: 'contract-1',
    title: 'A complete long request title', description: 'Full request body\nSecond line with all the details.',
    status: 'in_progress', attachmentSignedUrl: null, attachmentUnavailable: true,
    publicResponse: 'Maintenance will visit tomorrow.\nPlease be available.', respondedAt: '2026-11-26T10:00:00.000Z',
    createdAt: '2026-11-25T10:00:00.000Z', updatedAt: '2026-11-26T10:00:00.000Z',
  }

  it('opens complete detail with local dates, public response and recoverable attachment failure', async () => {
    requests.value = [request]
    loadDetail.mockResolvedValue({ ...request, publicResponse: 'The latest public response.' })
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('[aria-label="Xem yêu cầu: A complete long request title"]').trigger('click')
    await flushPromises()
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain(request.title)
    expect(dialog.text()).toContain(request.description)
    expect(dialog.text()).toContain('The latest public response.')
    expect(dialog.text()).toContain('Đã gửi:')
    expect(dialog.text()).toContain('Cập nhật:')
    expect(dialog.text()).not.toContain('T10:00:00.000Z')
    expect(dialog.text()).toContain('nội dung yêu cầu vẫn được lưu')
    expect(loadDetail).toHaveBeenCalledWith('request-1')
    loadDetail.mockRejectedValueOnce(new Error('offline'))
    await dialog.get('button').trigger('click')
    await flushPromises()
    expect(dialog.text()).toContain('Chưa tải được cập nhật mới')
    expect(dialog.text()).toContain(request.description)
    wrapper.unmount()
  })

  it('requires an explicit discard before leaving a changed request draft', async () => {
    route.query = { intent: 'profile-correction' }
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('[data-label="Mô tả"]').setValue('Unsaved evidence description')
    await wrapper.findAll('button').find(button => button.text() === 'Hủy')!.trigger('click')
    expect(wrapper.text()).toContain('Bỏ yêu cầu đang soạn?')
    expect(wrapper.find('form').exists()).toBe(true)
    await wrapper.findAll('button').find(button => button.text() === 'Tiếp tục soạn')!.trigger('click')
    await flushPromises()
    expect((wrapper.get('[data-label="Mô tả"]').element as HTMLInputElement).value).toBe('Unsaved evidence description')
    await wrapper.findAll('button').find(button => button.text() === 'Hủy')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Bỏ bản nháp')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('prefills payment reconciliation as neutral support text and never claims payment', async () => {
    route.query = { intent: 'payment-report', invoice: 'INV-2026-001', paid: 'true', amount: '1000000' }
    submit.mockResolvedValue(true)
    const wrapper = mount(RequestsPage, { global: { stubs } })
    expect((wrapper.get('[data-label="Tiêu đề"]').element as HTMLInputElement).value).toBe('Yêu cầu đối chiếu thanh toán')
    expect((wrapper.get('[data-label="Mô tả"]').element as HTMLInputElement).value).toContain('INV-2026-001')
    expect((wrapper.get('[data-label="Mô tả"]').element as HTMLInputElement).value).not.toContain('1000000')
    expect(wrapper.text()).toContain('không tự xác nhận thanh toán')
    await wrapper.get('[data-label="Mô tả"]').setValue('Please check my transfer for INV-2026-001.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(submit).toHaveBeenCalledWith({ title: 'Yêu cầu đối chiếu thanh toán', description: 'Please check my transfer for INV-2026-001.', attachment: undefined })
    expect(toastSuccess).toHaveBeenCalledWith('Đã gửi yêu cầu đối chiếu. Số dư hóa đơn chưa thay đổi.')
    wrapper.unmount()
  })

  it('ignores an invalid invoice code and retains edits if the route query changes', async () => {
    route.query = { intent: 'payment-report', invoice: '<private-invoice>' }
    const wrapper = mount(RequestsPage, { global: { stubs } })
    expect((wrapper.get('[data-label="Mô tả"]').element as HTMLInputElement).value).not.toContain('private-invoice')
    await wrapper.get('[data-label="Mô tả"]').setValue('My unsent message')
    route.query = { intent: 'payment-report', invoice: 'INV-OTHER' }
    await nextTick()
    expect((wrapper.get('[data-label="Mô tả"]').element as HTMLInputElement).value).toBe('My unsent message')
    wrapper.unmount()
  })

  it('requires payment context beyond the empty prefilled prompts', async () => {
    route.query = { intent: 'payment-report', invoice: 'INV-2026-001' }
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Bổ sung số tiền, thời gian chuyển hoặc chọn minh chứng')
    expect(submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('allows removing an invalid optional file without blocking a text-only request', async () => {
    route.query = { intent: 'profile-correction' }
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('[data-label="Mô tả"]').setValue('A text-only request')
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['bad'], 'bad.txt', { type: 'text/plain' })], configurable: true })
    await input.trigger('change')
    expect(wrapper.text()).toContain('Tệp phải là ảnh JPEG, PNG, WebP hoặc PDF.')
    await wrapper.findAll('button').find(button => button.text() === 'Bỏ tệp đã chọn')!.trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(submit).toHaveBeenCalledWith({ title: 'Yêu cầu chỉnh sửa hồ sơ', description: 'A text-only request', attachment: undefined })
    wrapper.unmount()
  })

  it('shows measured upload progress and prevents closing during submission', async () => {
    route.query = { intent: 'profile-correction' }
    const wrapper = mount(RequestsPage, { global: { stubs } })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['evidence'], 'proof.pdf', { type: 'application/pdf' })], configurable: true })
    await input.trigger('change')
    submitting.value = true
    progress.value = 37
    await nextTick()
    expect(wrapper.get('progress').attributes('value')).toBe('37')
    expect(wrapper.text()).toContain('Đang tải tệp 37%')
    expect(wrapper.findAll('button').find(button => button.text() === 'Hủy')!.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('exposes the next request page and its recoverable error without hiding history', async () => {
    requests.value = [request]
    hasMore.value = true
    loadMoreError.value = 'Could not load older requests'
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.findAll('button').find(button => button.text() === 'Xem yêu cầu cũ hơn')!.trigger('click')
    expect(loadMore).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain(request.title)
    expect(wrapper.text()).toContain('Could not load older requests')
    wrapper.unmount()
  })

  it('closes locally retained request details immediately when the account changes', async () => {
    requests.value = [request]
    const wrapper = mount(RequestsPage, { global: { stubs } })
    await wrapper.get('[aria-label="Xem yêu cầu: A complete long request title"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    requests.value = []
    sessionKey.value = 'portal-tenant-b-requests'
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(request.description)
    wrapper.unmount()
  })
})
