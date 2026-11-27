import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/access-requests.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'

const baseRequest = {
  authUserId: 'u', provider: 'email', decisionBuildingIds: [], decisionTenantId: null, rejectionReason: null,
  reviewedBy: null, reviewedAt: null, approvalClaimToken: null, createdAt: '2026-01-02T12:00:00Z', updatedAt: '2026-01-02T12:00:00Z',
}
const requests = ref<Record<string, unknown>[]>([])
const selectedStatus = ref('pending')
const pendingCount = ref<number | null>(3)

const UiEmptyState = defineComponent({
  props: ['title', 'description'],
  setup: props => () => h('div', { 'data-empty': '' }, [h('h3', props.title as string), h('p', props.description as string)]),
})
const UiSkeleton = defineComponent({ setup: () => () => h('div', { 'data-skeleton': '' }) })
const isLoading = ref(false)

const stubs = {
  UiPageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
  UiTabs,
  UiBadge,
  UiButton,
  UiEmptyState,
  UiSkeleton,
  UiAlert: true, UiModal: true, UiSelect: true, UiCheckbox: true, UiCombobox: true, UiTextarea: true,
}

beforeEach(() => {
  requests.value = []
  selectedStatus.value = 'pending'
  pendingCount.value = 3
  isLoading.value = false
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => ({ success: vi.fn(), error: vi.fn() }))
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useFetch', () => ({ data: ref(null) }))
  vi.stubGlobal('useAccessRequestPendingCount', () => pendingCount)
  vi.stubGlobal('useAccessRequests', () => ({
    selectedStatus, requests, isLoading, error: ref(null), approve: vi.fn(), reject: vi.fn(),
  }))
})

const mountPage = async () => {
  const wrapper = mount(Page, { global: { stubs } })
  await flushPromises()
  return wrapper
}

const tab = (wrapper: Awaited<ReturnType<typeof mountPage>>, label: string) =>
  wrapper.findAll('[role="tab"]').find(t => t.text().includes(label))!

describe('access requests page', () => {
  it('shows the pending count on the pending tab only', async () => {
    const wrapper = await mountPage()
    expect(tab(wrapper, 'Chờ duyệt').text()).toContain('3')
    expect(tab(wrapper, 'Đã duyệt').text()).not.toMatch(/\d/)

    pendingCount.value = null
    await flushPromises()
    expect(tab(wrapper, 'Chờ duyệt').text()).not.toMatch(/\d/)
  })

  it('switches the status filter when another tab is clicked', async () => {
    const wrapper = await mountPage()
    await tab(wrapper, 'Đã duyệt').trigger('click')
    expect(selectedStatus.value).toBe('approved')
  })

  it('replaces only the approve action with an unverified-email badge', async () => {
    requests.value = [{ ...baseRequest, id: 'r1', email: 'a@x.com', fullName: 'A', status: 'pending', emailVerified: false, decisionRole: null }]
    const wrapper = await mountPage()
    const row = wrapper.get('[data-request-id="r1"]')

    expect(row.text()).toContain('Chưa xác minh email')
    expect(row.text()).not.toContain('Duyệt')
    expect(row.text()).toContain('Từ chối')
  })

  it('keeps an unverified processing request free of reject and approve actions', async () => {
    requests.value = [{ ...baseRequest, id: 'r4', email: 'd@x.com', fullName: 'D', status: 'processing', emailVerified: false, decisionRole: null }]
    const wrapper = await mountPage()
    const row = wrapper.get('[data-request-id="r4"]')

    expect(row.text()).toContain('Chưa xác minh email')
    expect(row.text()).not.toContain('Từ chối')
    expect(row.text()).not.toContain('Tiếp tục')
  })

  it('names each row action after the requester', async () => {
    requests.value = [
      { ...baseRequest, id: 'r10', email: 'p@x.com', fullName: 'Phạm P', status: 'pending', emailVerified: true, decisionRole: null },
      { ...baseRequest, id: 'r11', email: 'q@x.com', fullName: null, status: 'processing', emailVerified: true, decisionRole: null },
    ]
    const wrapper = await mountPage()
    const label = (id: string) => wrapper.get(`[data-request-id="${id}"]`).findAll('button').map(b => b.attributes('aria-label'))

    expect(label('r10')).toEqual(['Từ chối yêu cầu của Phạm P', 'Duyệt yêu cầu của Phạm P'])
    expect(label('r11')).toEqual(['Tiếp tục duyệt yêu cầu của q@x.com'])
  })

  it('offers actions for a verified pending request', async () => {
    requests.value = [{ ...baseRequest, id: 'r2', email: 'b@x.com', fullName: 'B', status: 'pending', emailVerified: true, decisionRole: null }]
    const wrapper = await mountPage()

    expect(wrapper.get('[data-request-id="r2"]').text()).toContain('Duyệt')
    expect(wrapper.get('[data-request-id="r2"]').text()).not.toContain('Chưa xác minh email')
  })

  it('lets a verified processing request continue', async () => {
    requests.value = [{ ...baseRequest, id: 'r5', email: 'e@x.com', fullName: 'E', status: 'processing', emailVerified: true, decisionRole: null }]
    const wrapper = await mountPage()

    expect(wrapper.get('[data-request-id="r5"]').text()).toContain('Tiếp tục')
  })

  it('shows the product role name on decided requests', async () => {
    requests.value = [{ ...baseRequest, id: 'r3', email: 'c@x.com', fullName: 'C', status: 'approved', emailVerified: true, decisionRole: 'manager' }]
    const wrapper = await mountPage()

    expect(wrapper.get('[data-request-id="r3"]').text()).toContain('Quản lý')
  })

  it('marks rejected requests with muted text instead of actions', async () => {
    selectedStatus.value = 'rejected'
    requests.value = [{ ...baseRequest, id: 'r6', email: 'f@x.com', fullName: 'F', status: 'rejected', emailVerified: true, decisionRole: null }]
    const wrapper = await mountPage()
    const row = wrapper.get('[data-request-id="r6"]')

    expect(row.text()).toContain('Đã từ chối')
    expect(row.find('button').exists()).toBe(false)
  })

  it('renders requests as a shared list with initials, identity and meta line', async () => {
    requests.value = [
      { ...baseRequest, id: 'r7', email: 'lan@x.com', fullName: 'Nguyễn Văn Lan', provider: 'google', status: 'pending', emailVerified: true, decisionRole: null },
      { ...baseRequest, id: 'r8', email: 'mai@x.com', fullName: null, provider: 'password', status: 'pending', emailVerified: true, decisionRole: null },
      { ...baseRequest, id: 'r9', email: 'zed@x.com', fullName: null, provider: 'github', status: 'pending', emailVerified: true, decisionRole: null },
    ]
    const wrapper = await mountPage()

    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.get('ul[role="list"]').classes()).toContain('divide-y')
    const first = wrapper.get('[data-request-id="r7"]')
    expect(first.get('[aria-hidden="true"]').text()).toBe('NL')
    expect(first.text()).toContain('Nguyễn Văn Lan')
    expect(first.text()).toContain('lan@x.com · Google · 02/01/2026')
    const second = wrapper.get('[data-request-id="r8"]')
    expect(second.text()).toContain('Chưa cung cấp tên')
    expect(second.text()).toContain('mai@x.com · Email ·')
    expect(wrapper.get('[data-request-id="r9"]').text()).toContain('zed@x.com · Github ·')
  })

  it('shows skeleton rows while loading and the empty state for an empty queue', async () => {
    isLoading.value = true
    const loading = await mountPage()
    expect(loading.findAll('[data-skeleton]').length).toBeGreaterThan(0)

    isLoading.value = false
    const empty = await mountPage()
    expect(empty.get('[data-empty] h3').text()).toBe('Không có yêu cầu')
    expect(empty.get('[data-empty] p').text()).toBe('Hàng đợi ở trạng thái này đang trống.')
  })
})
