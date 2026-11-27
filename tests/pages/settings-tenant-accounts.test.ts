import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import Page from '~/pages/dashboard/settings/tenant-accounts.vue'

const initialAccounts = () => [
  { tenantId: 't1', tenantName: 'Hoàng Lam Thi', tenantCode: 'hlt-2026-0001', email: 'thyy1280@gmail.com' as string | null, health: 'linked', status: 'active' },
  { tenantId: 't2', tenantName: 'Nguyễn Tuấn Anh', tenantCode: 'nta-2026-0001', email: 'tuan.anh@gmail.com' as string | null, health: 'linked', status: 'active' },
]
const accounts = ref(initialAccounts())
const orphans = ref<unknown[]>([])
const setStatus = vi.fn()
const toast = { success: vi.fn(), error: vi.fn() }

const status = ref('success')
const error = ref<unknown>(null)

const UiEmptyState = defineComponent({
  props: ['title', 'description'],
  setup: props => () => h('div', { 'data-empty': '' }, [h('h3', props.title as string), h('p', props.description as string)]),
})
const UiSkeleton = defineComponent({ setup: () => () => h('div', { 'data-skeleton': '' }) })

const stubs = {
  UiPageHeader: { template: '<header><slot /><slot name="actions" /></header>' },
  UiSearchInput: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (_, { emit }) => () => h('input', { 'data-search': '', onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) }),
  UiDropdownMenu: { template: '<div data-menu><slot /></div>' },
  UiDropdownMenuItem: defineComponent({ emits: ['click'], setup: (_, { slots, emit }) => () => h('button', { 'data-item': '', onClick: () => emit('click') }, slots.default?.()) }),
  UiStatusBadge: defineComponent({ props: ['status'], setup: props => () => h('span', { 'data-status': props.status as string }) }),
  UiAlert: { template: '<div data-alert><slot /></div>' }, UiSkeleton, UiEmptyState, UiModal: true, UiConfirmModal: true, UiCombobox: true, UiInput: true,
  IconPlus: true, IconCheckCircle: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  orphans.value = []
  accounts.value = initialAccounts()
  status.value = 'success'
  error.value = null
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useToast', () => toast)
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useTenantAccounts', () => ({
    accounts, status, error, orphans, orphansLoading: ref(false), orphansError: ref(null),
    loadOrphans: vi.fn(), provision: vi.fn(), setStatus, resetPassword: vi.fn(), revoke: vi.fn(), reconcileOrphan: vi.fn(),
  }))
})

const mountPage = async () => {
  const wrapper = mount(Page, { global: { stubs } })
  await flushPromises()
  return wrapper
}

describe('tenant accounts page', () => {
  it('filters by name, code or email', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-search]').setValue('nta-2026')

    expect(wrapper.findAll('[data-tenant-id]').map(r => r.attributes('data-tenant-id'))).toEqual(['t2'])
    await wrapper.get('[data-search]').setValue('zzz')
    expect(wrapper.get('[data-empty] h3').text()).toBe('Không tìm thấy tài khoản')
    expect(wrapper.get('[data-empty] p').text()).toBe('Thử tên, mã hoặc email khác.')
  })

  it('renders rows as a shared list with name, status, code and email', async () => {
    const wrapper = await mountPage()
    const list = wrapper.get('ul[role="list"]')

    expect(list.classes()).toContain('divide-y')
    expect(wrapper.find('table').exists()).toBe(false)
    const row = wrapper.get('[data-tenant-id="t1"]')
    expect(row.get('p.truncate').text()).toBe('Hoàng Lam Thi')
    expect(row.get('[data-status]').attributes('data-status')).toBe('active')
    expect(row.get('.font-mono').text()).toBe('hlt-2026-0001')
    expect(row.text()).toContain('thyy1280@gmail.com')
  })

  it('flags a missing Auth account in the row', async () => {
    accounts.value = [{ tenantId: 't3', tenantName: 'Mất Auth', tenantCode: 'ma-1', email: null, health: 'missing_auth', status: 'active' }]
    const wrapper = await mountPage()
    const row = wrapper.get('[data-tenant-id="t3"]')

    expect(row.get('[data-status]').attributes('data-status')).toBe('missing_auth')
    expect(row.get('.text-status-warning').text()).toBe('Không có email Auth')
    expect(row.findAll('[data-item]').map(i => i.text()).at(-1)).toBe('Dọn liên kết')
  })

  it('shows three skeleton rows while loading and the empty state when there are no accounts', async () => {
    status.value = 'pending'
    const loading = await mountPage()
    expect(loading.findAll('[data-skeleton]')).toHaveLength(3)

    status.value = 'success'
    accounts.value = []
    const empty = await mountPage()
    expect(empty.get('[data-empty] h3').text()).toBe('Chưa có tài khoản nào')
  })

  it('shows the load error instead of the list', async () => {
    error.value = new Error('boom')
    const wrapper = await mountPage()

    expect(wrapper.find('[data-alert]').exists()).toBe(true)
    expect(wrapper.find('ul[role="list"]').exists()).toBe(false)
  })

  it('puts every row action in the menu with the agreed wording', async () => {
    const wrapper = await mountPage()
    const items = wrapper.get('[data-tenant-id="t1"]').findAll('[data-item]').map(i => i.text())

    expect(items).toEqual(['Khoá', 'Đặt lại mật khẩu', 'Gỡ quyền truy cập'])
  })

  it('uses a specific fallback when locking fails', async () => {
    setStatus.mockRejectedValueOnce(new Error())
    const wrapper = await mountPage()
    await wrapper.get('[data-tenant-id="t1"]').findAll('[data-item]')[0]!.trigger('click')
    await flushPromises()

    expect(toast.error).toHaveBeenCalledWith('Không thể khoá tài khoản.')
  })

  it('collapses a clean orphan check into one status line', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Không có tài khoản Auth mồ côi')
    expect(wrapper.text()).not.toContain('Mọi tài khoản tenant hiện có đều đang được liên kết')
  })
})
