import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/access-requests.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'

const baseRequest = {
  authUserId: 'u', provider: 'email', decisionBuildingIds: [], decisionTenantId: null, rejectionReason: null,
  reviewedBy: null, reviewedAt: null, approvalClaimToken: null, createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
}
const requests = ref<Record<string, unknown>[]>([])
const selectedStatus = ref('pending')
const pendingCount = ref<number | null>(3)

const UiTable = defineComponent({
  props: ['rows'],
  setup: (props, { slots }) => () => h('div', (props.rows as Record<string, unknown>[]).map(row => h('div', { 'data-row': row.id }, [
    slots['cell-identity']?.({ row }),
    slots['cell-status']?.({ row }),
    slots['cell-actions']?.({ row }),
  ]))),
})

const stubs = {
  UiPageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
  UiTable,
  UiTabs,
  UiBadge,
  UiButton,
  UiAlert: true, UiModal: true, UiSelect: true, UiCheckbox: true, UiCombobox: true, UiTextarea: true,
}

beforeEach(() => {
  requests.value = []
  selectedStatus.value = 'pending'
  pendingCount.value = 3
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => ({ success: vi.fn(), error: vi.fn() }))
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useFetch', () => ({ data: ref(null) }))
  vi.stubGlobal('useAccessRequestPendingCount', () => pendingCount)
  vi.stubGlobal('useAccessRequests', () => ({
    selectedStatus, requests, isLoading: ref(false), error: ref(null), approve: vi.fn(), reject: vi.fn(),
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

  it('replaces the approve action with an unverified-email badge', async () => {
    requests.value = [{ ...baseRequest, id: 'r1', email: 'a@x.com', fullName: 'A', status: 'pending', emailVerified: false, decisionRole: null }]
    const wrapper = await mountPage()
    const row = wrapper.get('[data-row="r1"]')

    expect(row.text()).toContain('Chưa xác minh email')
    expect(row.text()).not.toContain('Duyệt')
    expect(row.text()).not.toContain('Từ chối')
  })

  it('offers actions for a verified pending request', async () => {
    requests.value = [{ ...baseRequest, id: 'r2', email: 'b@x.com', fullName: 'B', status: 'pending', emailVerified: true, decisionRole: null }]
    const wrapper = await mountPage()

    expect(wrapper.get('[data-row="r2"]').text()).toContain('Duyệt')
    expect(wrapper.get('[data-row="r2"]').text()).not.toContain('Chưa xác minh email')
  })

  it('shows the product role name on decided requests', async () => {
    requests.value = [{ ...baseRequest, id: 'r3', email: 'c@x.com', fullName: 'C', status: 'approved', emailVerified: true, decisionRole: 'manager' }]
    const wrapper = await mountPage()

    expect(wrapper.get('[data-row="r3"]').text()).toContain('Quản lý')
  })
})
