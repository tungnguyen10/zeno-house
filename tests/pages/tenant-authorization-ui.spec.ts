import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, h, ref, nextTick, Suspense } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Detail from '~/pages/dashboard/tenants/[code]/index.vue'
import Edit from '~/pages/dashboard/tenants/[code]/edit.vue'
import Hero from '~/components/tenants/TenantDetailHero.vue'
import List from '~/pages/dashboard/tenants/index.vue'
import Accounts from '~/pages/dashboard/settings/tenant-accounts.vue'
import type { Tenant } from '~/types/tenants'

enableAutoUnmount(afterEach)

const profile = (): Tenant => ({ id: 't1', code: 'khach-1', fullName: 'Khách Một', phone: '0901234567', status: 'active', accessLevel: 'full', idNumber: 'private-id', email: 'private@example.com', createdAt: '2026-01-01', idCardFrontSignedUrl: 'https://private.test/id', emergencyContactName: 'Private Contact' })
const tenant = ref<Tenant | null>(null)
const pending = ref(false)
const requestStatus = ref('success')
const listTenants = ref<Tenant[]>([])
const bulkResult = { succeeded: ['t2'], failed: [{ id: 't1', reason: 'forbidden' }, { id: 't3', reason: 'forbidden' }, { id: 't4', reason: 'unknown_secret' }] }
const bulkBar = defineComponent({ emits: ['done'], setup: (_, { emit }) => () => h('button', { 'data-test': 'bulk-done', onClick: () => emit('done', bulkResult, 'archive') }, 'Run') })
const apiFetch = vi.fn()
const submitUpdate = vi.fn()
const lazyFetch = vi.fn()
const slot = defineComponent({ setup: (_, { slots }) => () => h('div', [slots.default?.(), slots.actions?.(), slots.footer?.()]) })
const form = defineComponent({ props: ['modelValue'], emits: ['submit', 'select-id-image'], setup: (_, { emit }) => () => h('button', { 'data-test': 'edit-form', onClick: () => emit('submit', {}) }, 'Save') })
const stubs = Object.fromEntries(['UiPageHeader', 'UiAlert', 'UiSurfacePanel', 'UiDefinitionList', 'UiDefinitionItem', 'UiBadge', 'UiListRow', 'UiButton', 'NuxtLink', 'UiModal', 'UiTable', 'AppSettingsSubNav', 'UiEmptyState'].map(name => [name, slot]))
const combobox = defineComponent({ name: 'UiCombobox', props: ['options', 'modelValue'], emits: ['update:modelValue', 'search'], template: '<div />' })
const allStubs = { ...stubs, IconArrowUpRight: true, IconDocument: true, IconDocumentText: true, IconDoor: true, IconMail: true, IconPhone: true, IconUsers: true, UiTextarea: true, UiDropdownMenu: slot, UiDropdownMenuItem: defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }), UiButton: defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }), TenantDetailHero: Hero, TenantBulkActionsBar: bulkBar, AppPullToRefresh: slot, TenantListToolbar: true, TenantBulkCreateModal: true, TenantExportModal: true, TenantForm: form, UiConfirmModal: true, UiSkeleton: true, UiCombobox: combobox, UiInput: true, UiStatusBadge: true }

beforeEach(() => {
  vi.clearAllMocks()
  tenant.value = profile()
  pending.value = false
  requestStatus.value = 'success'
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => ({ params: { code: 'khach-1' } }))
  vi.stubGlobal('useAuthStore', () => ({ can: () => true }))
  vi.stubGlobal('useIntersectionObserver', vi.fn())
  vi.stubGlobal('useAppHeaderTitle', () => ref(null))
  vi.stubGlobal('useTenantDetail', () => ({ tenant, isLoading: pending, error: ref(null), refresh: vi.fn() }))
  vi.stubGlobal('useLazyFetch', lazyFetch.mockImplementation((url: string) => url.startsWith('/api/tenants/')
    ? { data: computed(() => ({ data: tenant.value })), error: ref(null), status: requestStatus }
    : { data: ref({ data: [] }), error: ref(null), status: requestStatus }))
  vi.stubGlobal('useTenantForm', () => ({ isLoading: ref(false), errors: ref({}), apiError: ref(null), submitUpdate, hasDraft: ref(false), restoreDraft: vi.fn(), clearDraft: vi.fn(), isDirty: ref(false) }))
  vi.stubGlobal('useTenantAccounts', () => ({ accounts: ref([]), status: ref('success'), error: ref(null), orphans: ref([]), orphansLoading: ref(false), orphansError: ref(null), loadOrphans: vi.fn(), provision: vi.fn() }))
  vi.stubGlobal('useTenantList', () => ({ tenants: listTenants, total: ref(1), totalPages: ref(1), page: ref(1), q: ref(''), buildingFilter: ref(''), contractStateFilter: ref(''), status: ref([]), sort: ref('full_name'), order: ref('asc'), hasActiveFilters: ref(false), isLoading: ref(false), error: ref(null), refresh: vi.fn() }))
  vi.stubGlobal('useTenantBulkActions', () => ({ selectedIds: ref(['t1']), clear: vi.fn(), isRunning: ref(false) }))
  vi.stubGlobal('refreshNuxtData', vi.fn())
  vi.stubGlobal('TENANT_LIST_ASYNC_KEY', 'tenants:list')
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('apiFetch', apiFetch)
})

async function render(component: typeof Detail | typeof Edit | typeof Accounts | typeof List) {
  const wrapper = mount(defineComponent({ setup: () => () => h(Suspense, null, { default: () => h(component) }) }), { global: { stubs: allStubs } })
  await flushPromises()
  return wrapper
}

describe('tenant basic-access UI', () => {
  it('hides private profile and mutations while retaining scoped contract history without Portal fetches', async () => {
    tenant.value = { ...profile(), accessLevel: 'basic', activeAssignment: { contractId: 'c1', roomId: 'r1', roomNumber: 'Private Room', buildingId: 'b1', buildingName: 'Private Building', buildingSlug: null, assignmentRole: 'roommate', primaryTenantName: 'Private Primary' } }
    const wrapper = await render(Detail)
    expect(wrapper.text()).toContain('Bạn chỉ xem được thông tin cơ bản')
    expect(wrapper.text()).toContain('Hợp đồng')
    expect(wrapper.text()).not.toContain('Chỉnh sửa')
    expect(wrapper.text()).not.toContain('Vùng nguy hiểm')
    expect(wrapper.text()).not.toContain('private-id')
    expect(wrapper.text()).not.toContain('private@example.com')
    expect(wrapper.find('#id-document').exists()).toBe(false)
    expect(wrapper.find('#emergency').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Private Primary')
    expect(wrapper.text()).not.toContain('Private Room')
    expect(lazyFetch.mock.calls.some(([url]) => String(url).includes('account'))).toBe(false)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('keeps full controls and hides them immediately after access changes', async () => {
    const wrapper = await render(Detail)
    expect(wrapper.text()).toContain('Chỉnh sửa')
    expect(wrapper.text()).toContain('Vùng nguy hiểm')
    tenant.value = { ...profile(), accessLevel: 'basic' }
    await nextTick()
    expect(wrapper.text()).not.toContain('Chỉnh sửa')
    expect(wrapper.text()).not.toContain('Vùng nguy hiểm')
  })

  it('does not mount a direct edit form for basic access', async () => {
    tenant.value = { ...profile(), accessLevel: 'basic' }
    const wrapper = await render(Edit)
    expect(wrapper.find('[data-test="edit-form"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bạn chỉ xem được thông tin cơ bản')
    expect(submitUpdate).not.toHaveBeenCalled()
  })

  it('retains a full edit form and removes it while refreshing', async () => {
    const wrapper = await render(Edit)
    expect(wrapper.find('[data-test="edit-form"]').exists()).toBe(true)
    requestStatus.value = 'pending'
    await nextTick()
    expect(wrapper.find('[data-test="edit-form"]').exists()).toBe(false)
  })

  it('blocks stale edit events during refresh and image requests after access downgrades', async () => {
    const wrapper = await render(Edit)
    const editor = wrapper.findComponent(form)
    requestStatus.value = 'pending'
    editor.vm.$emit('submit', {})
    await nextTick()
    expect(submitUpdate).not.toHaveBeenCalled()
    requestStatus.value = 'success'
    await flushPromises()
    const activeEditor = wrapper.findComponent(form)
    activeEditor.vm.$emit('select-id-image', { side: 'front', file: new File(['id'], 'id.png', { type: 'image/png' }) })
    let resolveUpdate: (value: Tenant) => void = () => {}
    submitUpdate.mockImplementationOnce(() => new Promise<Tenant>(resolve => { resolveUpdate = resolve }))
    activeEditor.vm.$emit('submit', activeEditor.props('modelValue'))
    expect(submitUpdate).toHaveBeenCalledOnce()
    tenant.value = { ...profile(), accessLevel: 'basic' }
    resolveUpdate(profile())
    await flushPromises()
    expect(apiFetch).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="edit-form"]').exists()).toBe(false)
  })

  it('hero ignores stale sensitive fields and assignment metrics for basic', () => {
    const wrapper = mount(Hero, { props: { tenant: { ...profile(), accessLevel: 'basic' }, currentRoomLabel: 'Private Room' }, global: { stubs } })
    expect(wrapper.text()).toContain('Khách Một')
    expect(wrapper.text()).not.toContain('private-id')
    expect(wrapper.text()).not.toContain('private@example.com')
    expect(wrapper.text()).not.toContain('Private Room')
    expect(wrapper.find('dl').exists()).toBe(false)
  })

  it('groups bulk failures with truthful success counts and a safe unknown reason', async () => {
    listTenants.value = [{ ...profile(), accessLevel: 'basic' }]
    const wrapper = await render(List)
    expect(wrapper.text()).not.toContain('Chưa có HĐ')
    const select = wrapper.findAll('button').find(button => button.text().includes('Chọn nhiều khách thuê'))
    expect(select).toBeDefined()
    await select!.trigger('click')
    await wrapper.find('[data-test="bulk-done"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('1 thành công, 3 thất bại')
    expect(wrapper.text()).toContain('Ngoài phạm vi quản lý: 2')
    expect(wrapper.text()).toContain('Không thể thực hiện. Vui lòng thử lại.: 1')
    expect(wrapper.text()).not.toContain('unknown_secret')
  })

  it('clears a selected full Portal target when refreshed search marks it basic', async () => {
    vi.useFakeTimers()
    try {
      apiFetch.mockResolvedValueOnce({ data: [profile()] }).mockResolvedValueOnce({ data: [{ ...profile(), accessLevel: 'basic' }] })
      const wrapper = await render(Accounts)
      await wrapper.findAll('button').find(button => button.text().includes('Cấp tài khoản'))!.trigger('click')
      await flushPromises()
      const chooser = wrapper.findComponent(combobox)
      chooser.vm.$emit('update:modelValue', profile())
      await nextTick()
      expect(chooser.props('modelValue')?.id).toBe('t1')
      chooser.vm.$emit('search', 'Khách')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expect(chooser.props('modelValue')).toBeNull()
      expect(chooser.props('options')).toEqual([])
      wrapper.unmount()
    }
    finally { vi.useRealTimers() }
  })

  it('excludes basic tenants from Portal account provisioning options', async () => {
    apiFetch.mockResolvedValue({ data: [{ ...profile(), accessLevel: 'basic' }, { ...profile(), id: 't2', accessLevel: 'full' }] })
    const wrapper = await render(Accounts)
    const open = wrapper.findAll('button').find(c => c.text().includes('Cấp tài khoản'))
    expect(open).toBeDefined()
    await open!.trigger('click')
    await flushPromises()
    const options = wrapper.findComponent(combobox).props('options') as Tenant[]
    expect(options.map(option => option.id)).toEqual(['t2'])
  })
})
